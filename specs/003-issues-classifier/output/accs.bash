#!/usr/bin/env bash
set -uo pipefail

SPEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SPEC_ID="$(basename "$SPEC_DIR")"
MOCK_PORT="${MOCK_GITHUB_PORT:-4123}"
BASE="http://localhost:${MOCK_PORT}"
TMP_ROOT="$(mktemp -d)"
export GENERATED_DIR="$TMP_ROOT/.generated"
mkdir -p "$GENERATED_DIR"
JSONL="$GENERATED_DIR/$SPEC_ID/classifications.jsonl"
MOCK_LOG="$TMP_ROOT/mock.log"
MOCK_PID=""

cleanup() {
  if [ -n "$MOCK_PID" ] && kill -0 "$MOCK_PID" 2>/dev/null; then
    kill -- "-$MOCK_PID" 2>/dev/null || kill "$MOCK_PID" 2>/dev/null
    wait "$MOCK_PID" 2>/dev/null
  fi
  rm -rf "$TMP_ROOT"
}
trap cleanup EXIT

fail() {
  echo "ACCS FAIL: $1" >&2
  exit 1
}

find_mock_script() {
  pnpm run 2>/dev/null | grep -iE 'mock' | head -1 | sed -E 's/^[[:space:]]*//; s/[[:space:]].*$//'
}

MOCK_SCRIPT="$(find_mock_script)"
[ -n "$MOCK_SCRIPT" ] || fail "could not discover a pnpm script to run the GitHub mock (looked for a script name containing 'mock')"

start_mock() {
  # setsid: pnpm does not pass signals to the server it spawned, so the group is what gets killed.
  setsid pnpm run "$MOCK_SCRIPT" >>"$MOCK_LOG" 2>&1 &
  MOCK_PID=$!
  local tries=0
  until curl -fsS "$BASE/issues" >/dev/null 2>&1; do
    tries=$((tries+1))
    if [ "$tries" -gt 60 ]; then fail "mock github never became ready on $BASE, see $MOCK_LOG"; fi
    kill -0 "$MOCK_PID" 2>/dev/null || fail "mock github process died on startup, see $MOCK_LOG"
    sleep 1
  done
  sleep 10
}

stop_mock() {
  if [ -n "$MOCK_PID" ]; then
    kill -- "-$MOCK_PID" 2>/dev/null || kill "$MOCK_PID" 2>/dev/null
    wait "$MOCK_PID" 2>/dev/null
  fi
  # pnpm hands signals to nothing, and the server may outlive its wrapper by any route; whatever
  # still holds the port is the mock, whatever started it.
  lsof -ti "tcp:${MOCK_PORT}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  # The mock holds the port; the next start has to find it free, or it talks to the old state.
  local waited=0
  until ! curl -fsS "$BASE/issues" >/dev/null 2>&1; do
    waited=$((waited+1))
    [ "$waited" -gt 15 ] && fail "mock github still answering on $BASE after stop"
    sleep 1
  done
  MOCK_PID=""
}

echo "Starting mock GitHub via 'pnpm run $MOCK_SCRIPT'..."
start_mock

ISSUE_IDS="$(curl -fsS "$BASE/issues" | jq -r '.[].id' | sort)"
ISSUE_COUNT="$(echo "$ISSUE_IDS" | grep -c . || true)"
[ "$ISSUE_COUNT" -gt 0 ] || fail "mock reported zero issues, nothing to classify"

echo "Running first classify pass..."
FIRST_OUT="$(pnpm classify --spec-id "$SPEC_ID")"; FIRST_EXIT=$?
echo "$FIRST_OUT"
[ "$FIRST_EXIT" -eq 0 ] || fail "first classify pass exited non-zero"
[ -f "$JSONL" ] || fail "classifications.jsonl was not created at $JSONL"

JSONL_IDS="$(jq -r '.issueId' "$JSONL" | sort)"
JSONL_COUNT="$(jq -r '.issueId' "$JSONL" | wc -l)"
UNIQ_COUNT="$(echo "$JSONL_IDS" | sort -u | wc -l)"
[ "$JSONL_COUNT" -eq "$UNIQ_COUNT" ] || fail "duplicate issueId entries in classifications.jsonl"
[ "$JSONL_IDS" = "$ISSUE_IDS" ] || fail "classifications.jsonl issue set does not match mock's /issues (missing or extra entries)"

while IFS= read -r line; do
  echo "$line" | jq -e '
    (.priority|type=="number") and (.priority == (.priority|floor)) and (.priority>=0) and (.priority<=5) and
    (.effortEst|type=="number") and (.effortEst == (.effortEst|floor)) and (.effortEst>=0) and (.effortEst<=3) and
    (if .priority==0 then .effortEst==0 else true end) and
    (.reply|type=="string") and (.reply|length>0) and
    (.meta.timeInMs>0) and (.meta.etConsumed>0) and
    (((.meta.llmConfig|type=="string") and (.meta.llmConfig|length>0)) or ((.meta.llmConfig|type=="object") and (.meta.llmConfig|length>0)))
  ' >/dev/null || fail "malformed entry for issueId=$(echo "$line" | jq -r '.issueId')"
done < "$JSONL"

for id in $ISSUE_IDS; do
  echo "$FIRST_OUT" | grep -Eq "^(CLASSIFIED|SKIPPED|REPOSTED) issueId=$id$" \
    || fail "no stdout line for issueId=$id on first pass"
done

# Checks that the posted comment reflects the exact priority/effort numbers.
# A bare `grep -q "$pr"` would also match unrelated digits anywhere in the
# prose/table (e.g. priority=5 matching "15" or a date), so instead we require
# the number to sit as a whole token on a line that mentions the matching
# label (priority / effort), which any prose+table comment format satisfies.
check_comments() {
  local phase="$1"
  while IFS= read -r line; do
    local id pr ef comments marker body pr_line ef_line
    id="$(echo "$line" | jq -r '.issueId')"
    pr="$(echo "$line" | jq -r '.priority')"
    ef="$(echo "$line" | jq -r '.effortEst')"
    comments="$(curl -fsS "$BASE/issues/$id/comments")"
    marker="<!-- classifier:${SPEC_ID}:${id} -->"
    body="$(echo "$comments" | jq -r --arg m "$marker" '[.[] | (.body // .) | select(type=="string") | select(startswith($m))][0] // empty')"
    [ -n "$body" ] || fail "no marker comment found on GitHub for issueId=$id ($phase)"

    pr_line="$(echo "$body" | grep -iE 'priority' || true)"
    [ -n "$pr_line" ] || fail "comment for issueId=$id has no line mentioning priority ($phase)"
    echo "$pr_line" | grep -Eq "(^|[^0-9])${pr}([^0-9]|$)" \
      || fail "priority $pr not found as a whole number on the priority line for issueId=$id ($phase): $pr_line"

    ef_line="$(echo "$body" | grep -iE 'effort' || true)"
    [ -n "$ef_line" ] || fail "comment for issueId=$id has no line mentioning effort ($phase)"
    echo "$ef_line" | grep -Eq "(^|[^0-9])${ef}([^0-9]|$)" \
      || fail "effort $ef not found as a whole number on the effort line for issueId=$id ($phase): $ef_line"
  done < "$JSONL"
}

echo "Checking GitHub comments match classifications (first pass)..."
check_comments "first pass"

cp "$JSONL" "$TMP_ROOT/jsonl.before"

echo "Restarting mock GitHub (simulating memory loss)..."
stop_mock
start_mock

echo "Running second classify pass (expect replay, no new LLM calls)..."
SECOND_OUT="$(pnpm classify --spec-id "$SPEC_ID")"; SECOND_EXIT=$?
echo "$SECOND_OUT"
[ "$SECOND_EXIT" -eq 0 ] || fail "second classify pass exited non-zero"

for id in $ISSUE_IDS; do
  echo "$SECOND_OUT" | grep -Eq "^REPOSTED issueId=$id$" \
    || fail "issueId=$id was not REPOSTED on second pass (got: $(echo "$SECOND_OUT" | grep "issueId=$id" || echo 'nothing'))"
done

if ! diff -q "$TMP_ROOT/jsonl.before" "$JSONL" >/dev/null; then
  fail "classifications.jsonl changed after replay - byte-for-byte match required, meta (time/ET) must stay identical"
fi

echo "Checking GitHub comments exist again after replay..."
check_comments "after replay"

echo "ACCS PASS: spec $SPEC_ID matches desired world state."
exit 0

#!/usr/bin/env bash
set -uo pipefail

# ACCS for spec 002 - Proactive Issues Tracker + stateful mock GitHub
# Exit 0 => world matches spec. Exit 1 => it doesn't (or script itself is invalid).

cd "$(dirname "$0")/../../.." || exit 1
REPO_ROOT="$(pwd)"

[ -f .env ] && set -a && source .env && set +a
MOCK_GITHUB_PORT="${MOCK_GITHUB_PORT:-4000}"
BASE_URL="http://localhost:${MOCK_GITHUB_PORT}"

# Guard: only ever talk to our own local mock, never a real host.
case "$BASE_URL" in
  http://localhost:*|http://127.0.0.1:*) ;;
  *) echo "REFUSING: BASE_URL ($BASE_URL) is not local, aborting to avoid touching real GitHub"; exit 1 ;;
esac

PIDS=()
cleanup() {
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" 2>/dev/null
  done
  wait 2>/dev/null
}
trap cleanup EXIT

fail() { echo "FAIL: $1"; exit 1; }

# --- Step 1: gate on spec 001's accs.bash ---
ONE_ACCS=$(ls specs/001-*/output/accs.bash 2>/dev/null | head -n1)
[ -z "$ONE_ACCS" ] && fail "could not locate spec 001's accs.bash"

echo "Running 001 gate: $ONE_ACCS"
bash "$ONE_ACCS"
ONE_EXIT=$?
if [ "$ONE_EXIT" -ne 0 ]; then
  fail "spec 001 accs.bash failed (exit $ONE_EXIT) - terminating self per accs.md"
fi
echo "001 gate passed, tearing down anything it left on ${MOCK_GITHUB_PORT}"
fuser -k "${MOCK_GITHUB_PORT}"/tcp 2>/dev/null
sleep 1

# --- Step 2: start our own fresh mock GitHub ---
pnpm mock-github > /tmp/002-mock-github.log 2>&1 &
MOCK_PID=$!
PIDS+=("$MOCK_PID")
SPAWN_TS=$(date +%s.%N)

READY=0
for i in $(seq 1 50); do
  if curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/issues" | grep -q '^200$'; then
    READY=1; break
  fi
  sleep 0.2
done
[ "$READY" -ne 1 ] && fail "mock GitHub never became healthy on $BASE_URL"

ISSUES_JSON=$(curl -s "$BASE_URL/issues")
NONZERO=$(echo "$ISSUES_JSON" | jq '[.[] | select((.comments // []) | length > 0)] | length')
[ "$NONZERO" -ne 0 ] && fail "mock GitHub started with $NONZERO issue(s) already carrying comments, expected zero"
COUNT=$(echo "$ISSUES_JSON" | jq 'length')
[ "$COUNT" -lt 1 ] && fail "mock GitHub reports zero issues, nothing to track"

# --- Step 3: start the tracker ---
pnpm issues-tracker > /tmp/002-tracker.log 2>&1 &
TRACKER_PID=$!
PIDS+=("$TRACKER_PID")

# --- Step 4: curl a manual comment onto the first issue ---
FIRST_NUMBER=$(echo "$ISSUES_JSON" | jq '[.[].number] | min')
[ -z "$FIRST_NUMBER" ] || [ "$FIRST_NUMBER" = "null" ] && fail "could not determine first issue number"

CURL_CODE=$(curl -s -o /tmp/002-curl-comment.json -w '%{http_code}' \
  -X POST "$BASE_URL/issues/${FIRST_NUMBER}/comments" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Hello World!"}')
[ "$CURL_CODE" != "201" ] && fail "curl comment on issue #$FIRST_NUMBER returned $CURL_CODE, expected 201"

# --- Step 5: wait until 4s have passed since mock spawn ---
NOW_TS=$(date +%s.%N)
ELAPSED=$(echo "$NOW_TS - $SPAWN_TS" | bc)
REMAINING=$(echo "4 - $ELAPSED" | bc)
if (( $(echo "$REMAINING > 0" | bc -l) )); then
  sleep "$REMAINING"
fi

# --- Step 6: assert final state ---
FINAL_JSON=$(curl -s "$BASE_URL/issues")

FIRST_COMMENTS=$(echo "$FINAL_JSON" | jq --argjson n "$FIRST_NUMBER" '[.[] | select(.number == $n)][0].comments // []')
FIRST_COUNT=$(echo "$FIRST_COMMENTS" | jq 'length')
[ "$FIRST_COUNT" -ne 2 ] && fail "first issue #$FIRST_NUMBER has $FIRST_COUNT comment(s), expected exactly 2"

HAS_HELLO=$(echo "$FIRST_COMMENTS" | jq '[.[] | select(.body == "Hello World!")] | length')
HAS_TRACKER=$(echo "$FIRST_COMMENTS" | jq '[.[] | select(.author == "GitHub Issues Tracker" and .body == "I'"'"'ve been here!")] | length')
[ "$HAS_HELLO" -ne 1 ] && fail "first issue is missing the curl'd 'Hello World!' comment"
[ "$HAS_TRACKER" -ne 1 ] && fail "first issue is missing the tracker's 'I've been here!' comment"

BAD_ISSUES=$(echo "$FINAL_JSON" | jq --argjson n "$FIRST_NUMBER" '
  [.[] | select(.number != $n)] | map({
    number: .number,
    count: ((.comments // []) | length),
    onlyTracker: ((.comments // []) | all(.author == "GitHub Issues Tracker" and .body == "I'"'"'ve been here!"))
  }) | map(select((.count != 0 and .count != 1) or (.count == 1 and .onlyTracker == false)))
')
BAD_COUNT=$(echo "$BAD_ISSUES" | jq 'length')
if [ "$BAD_COUNT" -ne 0 ]; then
  echo "Offending issues: $BAD_ISSUES"
  fail "$BAD_COUNT other issue(s) don't match the '0 or exactly-1-tracker-comment' rule"
fi

AT_LEAST_ONE_TOUCHED=$(echo "$FINAL_JSON" | jq --argjson n "$FIRST_NUMBER" '[.[] | select(.number != $n and ((.comments // []) | length) == 1)] | length')
[ "$AT_LEAST_ONE_TOUCHED" -lt 1 ] && fail "no other issue got the tracker's comment - tracker may not be running"

echo "PASS: mock GitHub + proactive tracker behave as specced"
exit 0

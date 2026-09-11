#!/usr/bin/env bash
set -uo pipefail

PORT="${MOCK_GITHUB_PORT:-4001}"
POLL_MS="${ISSUE_TRACKER_POLL_MS:-1000}"
BASE="http://localhost:${PORT}"
MOCK_LOG="/tmp/accs002-mock.log"
PIDS=()

cleanup() {
  for pid in "${PIDS[@]:-}"; do
    [ -n "$pid" ] && kill "$pid" >/dev/null 2>&1
  done
}
trap cleanup EXIT

fail() { echo "ACCS FAIL: $1" >&2; exit 1; }

command -v jq >/dev/null || fail "jq is required"
command -v curl >/dev/null || fail "curl is required"
command -v bc >/dev/null || fail "bc is required"
command -v setsid >/dev/null || fail "setsid is required"
command -v timeout >/dev/null || fail "timeout is required"

# Step 1: run spec 001's accs.bash to completion first, mock-only chain.
SPEC001=$(ls specs/001-*/output/accs.bash 2>/dev/null | head -n1)
[ -n "$SPEC001" ] || fail "could not locate spec 001 accs.bash"

setsid bash "$SPEC001" &
SPEC001_PID=$!
wait "$SPEC001_PID"
SPEC001_STATUS=$?

kill -TERM -- -"$SPEC001_PID" >/dev/null 2>&1
sleep 0.3
kill -KILL -- -"$SPEC001_PID" >/dev/null 2>&1

if [ "$SPEC001_STATUS" -ne 0 ]; then
  fail "spec 001 accs.bash failed, aborting"
fi

# Step 2: mock-only hard gate
GATE_LOG_UNSET="/tmp/accs002-gate-unset.log"
GATE_LOG_BAD="/tmp/accs002-gate-bad.log"

(
  unset GITHUB_MODE
  export MOCK_GITHUB_PORT="$PORT" ISSUE_TRACKER_POLL_MS="$POLL_MS"
  timeout 3 pnpm issue-tracker:proactive
) >"$GATE_LOG_UNSET" 2>&1
GATE_UNSET_STATUS=$?
[ "$GATE_UNSET_STATUS" -ne 0 ] || fail "tracker should refuse to start with GITHUB_MODE unset, got exit 0"
[ "$GATE_UNSET_STATUS" -ne 124 ] || fail "tracker with GITHUB_MODE unset ran past a 3s timeout instead of gating immediately"

GITHUB_MODE=prod MOCK_GITHUB_PORT="$PORT" ISSUE_TRACKER_POLL_MS="$POLL_MS" timeout 3 pnpm issue-tracker:proactive >"$GATE_LOG_BAD" 2>&1
GATE_BAD_STATUS=$?
[ "$GATE_BAD_STATUS" -ne 0 ] || fail "tracker should refuse to start with GITHUB_MODE=prod, got exit 0"
[ "$GATE_BAD_STATUS" -ne 124 ] || fail "tracker with GITHUB_MODE=prod ran past a 3s timeout instead of gating immediately"

if grep -Eqi "ECONNREFUSED|fetch failed|econnrefused|ENOTFOUND" "$GATE_LOG_UNSET" "$GATE_LOG_BAD"; then
  fail "tracker attempted a network call before the mock-mode gate rejected it"
fi

# Step 3: boot the mock github service (mock-only)
GITHUB_MODE=mock MOCK_GITHUB_PORT="$PORT" pnpm mock-github >"$MOCK_LOG" 2>&1 &
MOCK_PID=$!
PIDS+=("$MOCK_PID")
MOCK_SPAWN_TS=$(date +%s.%N)

for i in $(seq 1 50); do
  curl -s -o /dev/null "$BASE/issues" && break
  sleep 0.1
done
curl -s -o /dev/null "$BASE/issues" || fail "mock github never came up on port $PORT"

ISSUES_JSON=$(curl -s "$BASE/issues")
ISSUE_COUNT=$(echo "$ISSUES_JSON" | jq 'length')
[ "$ISSUE_COUNT" -gt 0 ] || fail "no issues loaded at startup"

NONZERO=$(echo "$ISSUES_JSON" | jq '[.[] | select(.comments_count != 0)] | length')
[ "$NONZERO" -eq 0 ] || fail "some issues already have comments before tracker/curl touched them"

FIRST_ISSUE=$(echo "$ISSUES_JSON" | jq '[.[].number] | sort | .[0]')

# Step 4: boot the proactive tracker against the mock, mock-only
GITHUB_MODE=mock MOCK_GITHUB_PORT="$PORT" ISSUE_TRACKER_POLL_MS="$POLL_MS" pnpm issue-tracker:proactive >/tmp/accs002-tracker.log 2>&1 &
TRACKER_PID=$!
PIDS+=("$TRACKER_PID")

# Step 5: drop a human comment on the first issue via curl
curl -s -X POST "$BASE/issues/${FIRST_ISSUE}/comments" \
  -H 'Content-Type: application/json' \
  -d '{"body":"Hello World!"}' >/dev/null || fail "curl comment post failed"

# Step 6: wait until 4s have elapsed since the mock service spawn
NOW=$(date +%s.%N)
ELAPSED=$(echo "$NOW - $MOCK_SPAWN_TS" | bc)
REMAINING=$(echo "4 - $ELAPSED" | bc)
if (( $(echo "$REMAINING > 0" | bc -l) )); then
  sleep "$REMAINING"
fi

# give the terminal a moment to complete its next repaint tick after the 4s mark
sleep 0.3

# Step 7: verify the final HTTP state
FINAL_JSON=$(curl -s "$BASE/issues")

FIRST_COUNT=$(echo "$FINAL_JSON" | jq --argjson n "$FIRST_ISSUE" '.[] | select(.number == $n) | .comments_count')
[ "$FIRST_COUNT" -eq 2 ] || fail "first issue #$FIRST_ISSUE expected 2 comments, got $FIRST_COUNT"

OTHER_NUMBERS=$(echo "$FINAL_JSON" | jq --argjson n "$FIRST_ISSUE" '[.[] | select(.number != $n) | .number] | .[]')

for num in $OTHER_NUMBERS; do
  COUNT=$(echo "$FINAL_JSON" | jq --argjson n "$num" '.[] | select(.number == $n) | .comments_count')
  [ "$COUNT" -le 1 ] || fail "issue #$num expected at most 1 comment, got $COUNT"
  if [ "$COUNT" -eq 1 ]; then
    BODY=$(curl -s "$BASE/issues/${num}/comments" | jq -r '.[0].body')
    [ "$BODY" = "I've been here!" ] || fail "issue #$num single comment should be the tracker marker, got: $BODY"
  fi
done

FIRST_BODIES=$(curl -s "$BASE/issues/${FIRST_ISSUE}/comments" | jq -r '.[].body')
echo "$FIRST_BODIES" | grep -qF "Hello World!" || fail "first issue missing the curl comment"
echo "$FIRST_BODIES" | grep -qF "I've been here!" || fail "first issue missing the tracker marker comment"

# Step 8: verify the GitHub Service Terminal actually printed what the contract promises.
# The whole point here is proving a REPAINT, not just presence-anywhere-in-the-log: a
# diff-style repainter (forbidden by the contract) would still make a naive grep-anywhere
# check pass, since every issue gets logged at least once when added or touched. So instead
# we group the log into repaint blocks - a block is a maximal run of consecutive
# "Issue #<n>: <count> comment(s)" lines - and require the FINAL block on its own to contain
# every currently-loaded issue exactly once, with matching counts. Only a script that clears
# and reprints the full list top to bottom in one go can produce a block shaped like that.
[ -s "$MOCK_LOG" ] || fail "mock service produced no terminal output at all"

ISSUE_NUMBERS=$(echo "$FINAL_JSON" | jq -r '.[].number')
ISSUE_NUMBERS_COUNT=$(echo "$ISSUE_NUMBERS" | wc -l)

BLOCK_COUNT=$(awk '
  /Issue #[0-9]+: [0-9]+ comment\(s\)/ { inblock=1; next }
  { if (inblock) { c++; inblock=0 } }
  END { if (inblock) c++; print c+0 }
' "$MOCK_LOG")
[ "$BLOCK_COUNT" -ge 2 ] \
  || fail "terminal only produced $BLOCK_COUNT repaint block(s) of issue lines, expected multiple repaint cycles over ~4s"

LAST_BLOCK=$(awk '
  /Issue #[0-9]+: [0-9]+ comment\(s\)/ { buf = buf $0 "\n"; next }
  { if (buf != "") { last = buf; buf="" } }
  END { if (buf != "") { last = buf } printf "%s", last }
' "$MOCK_LOG")
[ -n "$LAST_BLOCK" ] || fail "could not isolate the final repaint block from the terminal log"

for num in $ISSUE_NUMBERS; do
  COUNT=$(echo "$FINAL_JSON" | jq --argjson n "$num" '.[] | select(.number == $n) | .comments_count')
  LINES_FOR_NUM=$(echo "$LAST_BLOCK" | grep -Ec "^Issue #${num}: [0-9]+ comment\(s\)$" || true)
  [ "$LINES_FOR_NUM" -eq 1 ] \
    || fail "final repaint block did not print issue #$num exactly once (got $LINES_FOR_NUM) - a full repaint must show every issue together in one shot, not scattered/diffed across the log"
  echo "$LAST_BLOCK" | grep -Eq "^Issue #${num}: ${COUNT} comment\(s\)$" \
    || fail "final repaint block shows a stale count for issue #$num, expected $COUNT"
done

LAST_BLOCK_LINE_COUNT=$(echo "$LAST_BLOCK" | grep -Ec "^Issue #[0-9]+: [0-9]+ comment\(s\)$" || true)
[ "$LAST_BLOCK_LINE_COUNT" -eq "$ISSUE_NUMBERS_COUNT" ] \
  || fail "final repaint block has $LAST_BLOCK_LINE_COUNT issue lines but $ISSUE_NUMBERS_COUNT issues are currently loaded - a full repaint must print the entire current list, not a subset"

echo "$LAST_BLOCK" | grep -Eq "^Issue #${FIRST_ISSUE}: 2 comment\(s\)$" \
  || fail "final repaint block never shows issue #$FIRST_ISSUE at its final count of 2 comments"

TOTAL_COMMENTS=$(echo "$FINAL_JSON" | jq '[.[].comments_count] | add')
NEW_COMMENT_LINES=$(grep -c "New comment on issue #" "$MOCK_LOG" || true)
[ "$NEW_COMMENT_LINES" -ge "$TOTAL_COMMENTS" ] \
  || fail "expected at least $TOTAL_COMMENTS 'New comment on issue #' log lines, got $NEW_COMMENT_LINES"

grep -q "New comment on issue #${FIRST_ISSUE}" "$MOCK_LOG" \
  || fail "missing 'New comment on issue #$FIRST_ISSUE' log line"

echo "ACCS OK: mock-only stateful github + proactive tracker behave per spec 002"
exit 0

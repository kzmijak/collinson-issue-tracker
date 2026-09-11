#!/usr/bin/env bash
set -u

if [ -z "${ACCS_SELF_WRAPPED:-}" ]; then
  export ACCS_SELF_WRAPPED=1
  exec timeout 60 "$0" "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
OUT_DIR="$SCRIPT_DIR"
TS="$(date +%s%N)"
MOCK_LOG="$OUT_DIR/mock.accs.$TS.log"
TRACKER_LOG="$OUT_DIR/tracker.accs.$TS.log"

PORT="${PORT:-4123}"
export GITHUB_REPO="${GITHUB_REPO:-acme/widgets}"
BASE_URL="http://localhost:$PORT"
ISSUES_URL="$BASE_URL/repos/${GITHUB_REPO}/issues"

MOCK_PID=""
READER_PID=""

cleanup() {
  [ -n "$READER_PID" ] && kill -- -"$READER_PID" >/dev/null 2>&1
  [ -n "$MOCK_PID" ] && kill -- -"$MOCK_PID" >/dev/null 2>&1
}
trap cleanup EXIT

fail() {
  echo "FAIL: $1"
  exit 1
}

count_field() {
  # $1 = json on stdin, $2 = state filter ('open'|'closed'|'')
  node -e '
    const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
    const state = process.argv[1];
    const list = state ? d.filter(i => i.state === state) : d;
    console.log(list.length);
  ' "$2"
}

list_numbers() {
  node -e '
    const d = JSON.parse(require("fs").readFileSync(0,"utf8"));
    const state = process.argv[1];
    d.filter(i => i.state === state).forEach(i => console.log(i.number));
  ' "$1"
}

cd "$REPO_ROOT" || fail "cannot cd to repo root"

setsid pnpm mock-github > "$MOCK_LOG" 2>&1 &
MOCK_PID=$!

T0=""
RESP=""
for attempt in 1 2 3; do
  if RESP=$(curl -s --max-time 5 "$ISSUES_URL") && [ -n "$RESP" ]; then
    T0=$(date +%s)
    break
  fi
  sleep 1.4
done
[ -n "$T0" ] || fail "mock-github never answered within probe budget"

INITIAL_TOTAL=$(echo "$RESP" | count_field "" "")
CLOSED_COUNT=$(echo "$RESP" | count_field "" closed)
[ "$INITIAL_TOTAL" -ge 1 ] || fail "initial curl returned no issues"
[ "$CLOSED_COUNT" -ge 1 ] || fail "seed dataset has no closed issue"

setsid pnpm prototype-issues-reader > "$TRACKER_LOG" 2>&1 &
READER_PID=$!

sleep 2
SNAP_LINES=$(wc -l < "$TRACKER_LOG")
[ "$SNAP_LINES" -gt 0 ] || fail "tracker produced no complete line yet"
SNAPSHOT_1=$(head -n "$SNAP_LINES" "$TRACKER_LOG")

NOW=$(date +%s); ELAPSED=$((NOW - T0)); WAIT=$((4 - ELAPSED))
[ "$WAIT" -gt 0 ] && sleep "$WAIT"

RESP2=$(curl -s --max-time 5 "$ISSUES_URL") || fail "curl failed at 4s mark"
COUNT2=$(echo "$RESP2" | count_field "" "")
[ "$COUNT2" -gt "$INITIAL_TOTAL" ] || fail "issue count did not grow by the 4s mark"

sleep 1.2
LINES_NOW=$(wc -l < "$TRACKER_LOG")
[ "$LINES_NOW" -gt "$SNAP_LINES" ] || fail "tracker did not append new lines after dataset grew"
RECHECK_1=$(head -n "$SNAP_LINES" "$TRACKER_LOG")
[ "$RECHECK_1" == "$SNAPSHOT_1" ] || fail "append-only violation: earlier tracker lines changed"

NOW=$(date +%s); ELAPSED=$((NOW - T0)); TARGET=13; WAIT=$((TARGET - ELAPSED))
[ "$WAIT" -gt 0 ] && sleep "$WAIT"

RESP3=$(curl -s --max-time 5 "$ISSUES_URL") || fail "final curl failed"
COUNT3=$(echo "$RESP3" | count_field "" "")
[ "$COUNT3" -eq 20 ] || fail "dataset did not settle at 20 issues (got $COUNT3)"

OPEN_NUMS=$(echo "$RESP3" | list_numbers open)
CLOSED_NUMS=$(echo "$RESP3" | list_numbers closed)

for n in $OPEN_NUMS; do
  grep -qw "$n" "$TRACKER_LOG" || fail "open issue $n missing from tracker output"
done
for n in $CLOSED_NUMS; do
  grep -qw "$n" "$TRACKER_LOG" && fail "closed issue $n leaked into tracker output"
done

FINAL_RECHECK=$(head -n "$SNAP_LINES" "$TRACKER_LOG")
[ "$FINAL_RECHECK" == "$SNAPSHOT_1" ] || fail "append-only violation on final recheck"

LAST_BYTE=$(tail -c1 "$TRACKER_LOG" | od -An -tx1 | tr -d ' \n')
[ "$LAST_BYTE" != "0a" ] || fail "tracker log ends with newline; expected an in-place, non-newline-terminated status bar fragment"

echo "PASS: mock grew ${INITIAL_TOTAL}->${COUNT3}, tracker append-only holds across two head -n${SNAP_LINES} extractions, no closed issue leaked, live status bar confirmed"
exit 0

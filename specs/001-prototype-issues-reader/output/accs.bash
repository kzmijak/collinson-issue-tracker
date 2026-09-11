#!/usr/bin/env bash
set -u

# Wrap the whole run in a hard 60s deadline exactly once.
if [ -z "${ACCS_WRAPPED:-}" ]; then
  export ACCS_WRAPPED=1
  exec timeout 60 "$0" "$@"
fi

PHASE="init"
MOCK_PID=""
TRACKER_PID=""
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MOCK_LOG="$HERE/mock.accs.log"
TRACKER_LOG="$HERE/tracker.accs.log"
SNAP="$HERE/snapshot.accs.log"
: > "$MOCK_LOG"; : > "$TRACKER_LOG"

PORT="${MOCK_GITHUB_PORT:-4123}"
OWNER="${GITHUB_OWNER:-owner}"
REPO="${GITHUB_REPO:-repo}"
URL="http://localhost:${PORT}/repos/${OWNER}/${REPO}/issues"

cleanup() {
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" >/dev/null 2>&1
  [ -n "$TRACKER_PID" ] && kill "$TRACKER_PID" >/dev/null 2>&1
}
trap cleanup EXIT

fail() {
  echo "PHASE-FAILED: ${PHASE} - $1"
  exit 1
}

parse_json() {
  # $1 = file with raw JSON body. Prints "open_count closed_count open_nums closed_nums" as 4 lines.
  node -e '
    const fs=require("fs");
    const raw=fs.readFileSync(process.argv[1],"utf8");
    let data;
    try { data = JSON.parse(raw); } catch(e) { console.log("PARSE_ERROR"); process.exit(0); }
    if (!Array.isArray(data)) { console.log("PARSE_ERROR"); process.exit(0); }
    const open = data.filter(i => i.state === "open").map(i => i.number);
    const closed = data.filter(i => i.state === "closed").map(i => i.number);
    console.log(data.length);
    console.log(open.length);
    console.log(closed.length);
    console.log(open.join(","));
    console.log(closed.join(","));
  ' "$1"
}

assert_numbers_present() {
  # $1 = comma list of numbers that must appear as whole words outside Polling lines
  local list="$1"
  [ -z "$list" ] && return 0
  IFS=',' read -ra nums <<< "$list"
  for n in "${nums[@]}"; do
    grep -v 'Polling' "$TRACKER_LOG" | grep -qw "$n" || fail "expected open issue $n missing from tracker output"
  done
}

assert_numbers_absent() {
  local list="$1"
  [ -z "$list" ] && return 0
  IFS=',' read -ra nums <<< "$list"
  for n in "${nums[@]}"; do
    if grep -qw "$n" "$TRACKER_LOG"; then
      fail "closed issue $n leaked into tracker output"
    fi
  done
}

PHASE="mock boot"
pnpm mock-github > "$MOCK_LOG" 2>&1 &
MOCK_PID=$!
MOCK_START=$(date +%s)

ready=0
for i in $(seq 1 10); do
  if curl -s --max-time 5 -o "$HERE/first.json" -w '%{http_code}' "$URL" 2>/dev/null | grep -q '^2'; then
    ready=1
    break
  fi
  sleep 1
done
[ "$ready" -eq 1 ] || fail "mock-github never answered $URL"

PHASE="initial curl"
read -r TOTAL1 OPEN_CNT1 CLOSED_CNT1 OPEN_LIST1 CLOSED_LIST1 <<< "$(parse_json "$HERE/first.json" | tr '\n' ' ')"
[ "$TOTAL1" = "PARSE_ERROR" ] && fail "first curl response was not valid JSON array"
[ "$TOTAL1" -ge 15 ] 2>/dev/null || fail "expected >=15 seed issues, got $TOTAL1"
[ "$CLOSED_CNT1" -ge 1 ] 2>/dev/null || fail "seed dataset must contain at least one closed issue"

PHASE="tracker boot"
pnpm prototype-issues-reader > "$TRACKER_LOG" 2>&1 &
TRACKER_PID=$!

PHASE="post-start wait"
sleep 4

PHASE="initial display check"
assert_numbers_present "$OPEN_LIST1"
assert_numbers_absent "$CLOSED_LIST1"

PHASE="append-only snapshot"
cp "$TRACKER_LOG" "$SNAP"
L=$(wc -l < "$SNAP")

PHASE="growth wait"
NOW=$(date +%s)
ELAPSED=$((NOW - MOCK_START))
REMAIN=$((10 - ELAPSED))
[ "$REMAIN" -gt 0 ] && sleep "$REMAIN"
sleep 3

PHASE="growth curl"
curl -s --max-time 5 -o "$HERE/second.json" -w '%{http_code}' "$URL" 2>/dev/null | grep -q '^2' || fail "mock-github stopped answering on growth curl"
read -r TOTAL2 OPEN_CNT2 CLOSED_CNT2 OPEN_LIST2 CLOSED_LIST2 <<< "$(parse_json "$HERE/second.json" | tr '\n' ' ')"
[ "$TOTAL2" = "PARSE_ERROR" ] && fail "growth curl response was not valid JSON array"
[ "$TOTAL2" -gt "$TOTAL1" ] 2>/dev/null || fail "dataset did not grow (was $TOTAL1, now $TOTAL2)"

PHASE="settle wait"
sleep 3

PHASE="proactive pickup check"
assert_numbers_present "$OPEN_LIST2"
assert_numbers_absent "$CLOSED_LIST2"

PHASE="append-only check"
head -n "$L" "$TRACKER_LOG" > "$HERE/head.log"
diff -q "$SNAP" "$HERE/head.log" >/dev/null || fail "earlier tracker lines were altered, not append-only"

PHASE="status bar liveliness"
live_ok=0
for attempt in 1 2 3; do
  s1=$(grep 'Polling' "$TRACKER_LOG" | tail -1)
  sleep 1.4
  s2=$(grep 'Polling' "$TRACKER_LOG" | tail -1)
  if echo "$s1" | grep -qE 'Polling\.{1,3}([^.]|$)' && echo "$s2" | grep -qE 'Polling\.{1,3}([^.]|$)' && [ "$s1" != "$s2" ]; then
    live_ok=1
    break
  fi
done
[ "$live_ok" -eq 1 ] || fail "Polling status bar not live (1-3 dots, changing) across samples"

rm -f "$HERE/first.json" "$HERE/second.json" "$HERE/head.log"
echo "ACCS PASSED - world matches spec 001-prototype-issues-reader"
exit 0

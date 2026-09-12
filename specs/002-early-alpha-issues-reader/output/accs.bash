#!/usr/bin/env bash
set -uo pipefail

PORT="${MOCK_GITHUB_PORT:-4123}"
BASE_URL="http://localhost:$PORT"
REPAINT_MS="${MOCK_GITHUB_REPAINT_LATENCY_MS:-500}"
LOG="$(mktemp)"
MOCK_PID=""
TRACKER_PID=""

fail() { echo "ACCS FAIL: $1" >&2; cleanup; exit 1; }

free_port() {
  local pids
  pids=$(lsof -ti:"$PORT" 2>/dev/null || true)
  if [ -n "$pids" ]; then kill $pids 2>/dev/null || true; sleep 1; fi
}

cleanup() {
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null
  [ -n "$TRACKER_PID" ] && kill "$TRACKER_PID" 2>/dev/null
  free_port
  rm -f "$LOG"
}
trap cleanup EXIT

# check_snapshots CAP: single pass, no scratch files.
# validates: n strictly increasing, no dup issue id within a snapshot,
# per-snapshot line count <= CAP, and if a snapshot hit CAP exactly its
# last line must be the literal truncation marker "...".
check_snapshots() {
  local cap="$1"
  awk -v cap="$cap" '
    BEGIN { lastN = -1 }
    function flush(   ) {
      if (lastN >= 0) {
        if (lines > cap) { print "FAIL cap-exceeded snap=" lastN " lines=" lines " cap=" cap; bad=1; exit }
        if (lines == cap && lastLine != "...") { print "FAIL no-truncation-marker snap=" lastN; bad=1; exit }
      }
    }
    /^===SNAPSHOT [0-9]+ / {
      n=$2+0
      if (n<=lastN) { print "FAIL nonmonotonic " n " after " lastN; bad=1; exit }
      flush()
      lastN=n; snapCount++; lines=1; lastLine=$0; delete seen
      next
    }
    lastN >= 0 {
      lines++; lastLine=$0
      if ($0 ~ /^Issues #/) {
        s=$0; sub(/^Issues #/,"",s); sub(/:.*/,"",s); id=s
        if (id in seen) { print "FAIL dup " id " in snapshot " lastN; bad=1; exit }
        seen[id]=1
      }
    }
    END { if (!bad) { flush(); if (!bad) print "OK lastN=" lastN " snapCount=" snapCount } }
  ' "$LOG"
}

free_port

# --- Phase 0: force truncation with a tiny cap, unrelated to the coverage run below ---
TRUNC_LOG="$(mktemp)"
export MOCK_GITHUB_PORT="$PORT"
export MOCK_GITHUB_BUFFER_CAP=3
pnpm mock-github > "$TRUNC_LOG" 2>&1 &
MOCK_PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null "$BASE_URL/issues" && break; sleep 0.5; done
curl -s -o /dev/null "$BASE_URL/issues" || fail "mock-github (trunc phase) never came up"
sleep 2
grep -q '^\.\.\.$' "$TRUNC_LOG" || fail "no truncation '...' line seen with MOCK_GITHUB_BUFFER_CAP=3"
LOG="$TRUNC_LOG" 
RES0=$(check_snapshots 3)
echo "$RES0" | grep -q '^FAIL' && fail "$RES0 (trunc phase)"
kill "$MOCK_PID" 2>/dev/null; MOCK_PID=""
free_port
rm -f "$TRUNC_LOG"
unset MOCK_GITHUB_BUFFER_CAP
LOG="$(mktemp)"

# --- Phase 0b: default cap, no override, no tty -> must fall back to hard 200 ---
DEFAULT_LOG="$(mktemp)"
pnpm mock-github > "$DEFAULT_LOG" 2>&1 &
MOCK_PID=$!
for i in $(seq 1 30); do curl -s -o /dev/null "$BASE_URL/issues" && break; sleep 0.5; done
curl -s -o /dev/null "$BASE_URL/issues" || fail "mock-github (default-cap phase) never came up"
sleep 2
LOG="$DEFAULT_LOG"
RES0B=$(check_snapshots 200)
echo "$RES0B" | grep -q '^FAIL' && fail "$RES0B (default-cap phase)"
kill "$MOCK_PID" 2>/dev/null; MOCK_PID=""
free_port
rm -f "$DEFAULT_LOG"
LOG="$(mktemp)"

# --- Phase 1: main flow, full-coverage cap override per contract ---
export MOCK_GITHUB_PORT="$PORT"
export MOCK_GITHUB_BUFFER_CAP=500
pnpm mock-github > "$LOG" 2>&1 &
MOCK_PID=$!

for i in $(seq 1 30); do
  curl -s -o /dev/null "$BASE_URL/issues" && break
  sleep 0.5
done
curl -s -o /dev/null "$BASE_URL/issues" || fail "mock-github never came up on port $PORT"

sleep 1
INITIAL=$(curl -s "$BASE_URL/issues")
echo "$INITIAL" | jq -e 'length > 0' >/dev/null || fail "no issues loaded on startup"
echo "$INITIAL" | jq -e '[.[] | (.comments|length)] | all(. == 0)' >/dev/null || fail "fresh issues already have comments"

RES1=$(check_snapshots 500)
echo "$RES1" | grep -q '^FAIL' && fail "$RES1"
COUNT1=$(echo "$RES1" | sed -n 's/.*snapCount=\([0-9]*\).*/\1/p')

sleep 4

RES2=$(check_snapshots 500)
echo "$RES2" | grep -q '^FAIL' && fail "$RES2"
COUNT2=$(echo "$RES2" | sed -n 's/.*snapCount=\([0-9]*\).*/\1/p')
[ "$COUNT2" -gt "$COUNT1" ] || fail "no new snapshot/entries observed 4s after startup"

AFTER4=$(curl -s "$BASE_URL/issues")
N1=$(echo "$INITIAL" | jq 'length')
N2=$(echo "$AFTER4" | jq 'length')
[ "$N2" -ge "$N1" ] || fail "issue count did not grow between checks"

FIRST_ID=$(echo "$AFTER4" | jq -r '.[0].id')

CODE=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/issues/$FIRST_ID/comments" -H 'Content-Type: application/json' -d '{"author":"tester","body":"Hello World!"}')
[ "$CODE" = "201" ] || fail "POST comment did not return 201 (got $CODE)"

WAIT_S=$(awk -v ms="$REPAINT_MS" 'BEGIN{print (ms*5)/1000}')
sleep "$WAIT_S"

RES3=$(check_snapshots 500)
echo "$RES3" | grep -q '^FAIL' && fail "$RES3"

AFTER_COMMENT=$(curl -s "$BASE_URL/issues")
CC=$(echo "$AFTER_COMMENT" | jq --arg id "$FIRST_ID" '[.[] | select((.id|tostring)==$id)][0].comments | length')
[ "$CC" -eq 1 ] || fail "first issue expected 1 comment after manual POST, has $CC"

pnpm issues-tracker > /tmp/accs-tracker.log 2>&1 &
TRACKER_PID=$!
sleep 6
kill "$TRACKER_PID" 2>/dev/null
TRACKER_PID=""

FINAL=$(curl -s "$BASE_URL/issues")
FIRST_CC=$(echo "$FINAL" | jq --arg id "$FIRST_ID" '[.[] | select((.id|tostring)==$id)][0].comments | length')
[ "$FIRST_CC" -eq 2 ] || fail "first issue expected 2 comments after tracker run, has $FIRST_CC"

BAD_OTHERS=$(echo "$FINAL" | jq --arg id "$FIRST_ID" '[.[] | select((.id|tostring)!=$id) | select((.comments|length) > 1)] | length')
[ "$BAD_OTHERS" -eq 0 ] || fail "an issue other than the first has more than 1 comment"

BAD_BODY=$(echo "$FINAL" | jq --arg id "$FIRST_ID" '[.[] | select((.id|tostring)!=$id) | .comments[]? | select(.body != "I'"'"'ve been here!" or .author != "GitHub Issues Tracker")] | length')
[ "$BAD_BODY" -eq 0 ] || fail "tracker comment body/author mismatch on a non-first issue"

FIRST_SECOND_COMMENT=$(echo "$FINAL" | jq --arg id "$FIRST_ID" '[.[] | select((.id|tostring)==$id)][0].comments[1]')
echo "$FIRST_SECOND_COMMENT" | jq -e '.body == "I'"'"'ve been here!" and .author == "GitHub Issues Tracker"' >/dev/null || fail "first issue's 2nd comment is not the tracker's touch"

RES4=$(check_snapshots 500)
echo "$RES4" | grep -q '^FAIL' && fail "$RES4"

echo "ACCS PASS"
exit 0

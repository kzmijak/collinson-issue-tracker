#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../../.."
OUT="specs/002-early-alpha-issues-reader/output"
LOG="$OUT/mock.log"
PORT="${MOCK_GITHUB_PORT:-4123}"
BASE="http://localhost:$PORT"
MOCK_PID=""
TRACKER_PID=""

cleanup() {
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null
  [ -n "$TRACKER_PID" ] && kill "$TRACKER_PID" 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT

fail() { echo "ACCS FAIL: $1"; exit 1; }

# --- check for duplicate issue ids within any single snapshot block ---
check_no_dupes() {
  awk '
    /^===SNAPSHOT/ { if (block!="") { print block; }; block=""; next }
    { block = block $0 "\n" }
    END { if (block!="") print block }
  ' "$LOG" | csplit -s -z -f "$OUT/blk" - "/^$/" 2>/dev/null || true
  # simpler: scan whole log per-snapshot using awk state machine
  awk '
    /^===SNAPSHOT/ { for (id in seen) delete seen[id]; next }
    match($0,/Issues #([0-9]+):/,m) {
      if (m[1] in seen) { print "DUPLICATE #" m[1]; exit 1 }
      seen[m[1]]=1
    }
  ' "$LOG" > /tmp/dupcheck.$$ 2>&1
  if grep -q DUPLICATE /tmp/dupcheck.$$; then
    cat /tmp/dupcheck.$$; rm -f /tmp/dupcheck.$$; fail "issue repeated twice within one screen"
  fi
  rm -f /tmp/dupcheck.$$
}

count_ids_in_last_snapshot() {
  awk '/^===SNAPSHOT/{block=""} {block=block $0 "\n"} END{print block}' "$LOG" | grep -c "Issues #"
}

# --- step 1: run spec 001's frozen accs.bash ---
SPEC001=$(ls specs/001-*/output/accs.bash 2>/dev/null | head -1)
[ -z "$SPEC001" ] && fail "spec 001 accs.bash not found"
bash "$SPEC001"
if [ $? -ne 0 ]; then fail "spec 001 accs.bash failed"; fi
# spec 001 succeeded: make sure nothing of its lingers on our port
pkill -f "pnpm mock-github" 2>/dev/null; sleep 1

# --- step 2: run our own mock github instance ---
MOCK_GITHUB_BUFFER_CAP=500 MOCK_GITHUB_PORT="$PORT" pnpm mock-github > "$LOG" 2>&1 &
MOCK_PID=$!
START=$(date +%s)

# wait for server
for i in $(seq 1 30); do curl -sf "$BASE/issues" > /dev/null 2>&1 && break; sleep 0.3; done
curl -sf "$BASE/issues" > /dev/null 2>&1 || fail "mock-github never came up"

# --- step 3: issues exist, none have comments yet ---
ISSUES_JSON=$(curl -sf "$BASE/issues")
WITH_COMMENTS=$(echo "$ISSUES_JSON" | grep -c '"comments":\[.\+\]' || true)
[ "$WITH_COMMENTS" != "0" ] && fail "issues already had comments before any mutation"
FIRST_COUNT=$(count_ids_in_last_snapshot)
[ "$FIRST_COUNT" -lt 1 ] && fail "no issue lines seen in first snapshot"

# --- step 4: wait until 4s since spawn, expect growth, no dupes ---
NOW=$(date +%s)
ELAPSED=$((NOW-START))
[ "$ELAPSED" -lt 4 ] && sleep $((4-ELAPSED))
check_no_dupes
SECOND_COUNT=$(count_ids_in_last_snapshot)
[ "$SECOND_COUNT" -le "$FIRST_COUNT" ] && fail "expected more issues after 4s, got $SECOND_COUNT vs $FIRST_COUNT"

# --- step 5: post a comment to first issue via curl ---
FIRST_ID=$(echo "$ISSUES_JSON" | grep -o '"id":[0-9]*' | head -1 | grep -o '[0-9]*')
[ -z "$FIRST_ID" ] && fail "could not determine first issue id"
curl -sf -X POST "$BASE/issues/$FIRST_ID/comments" -H 'Content-Type: application/json' -d '{"author":"tester","body":"Hello World!"}' > /dev/null || fail "POST comment failed"
sleep 0.5

# --- step 6: confirm first issue logs it has one comment ---
grep -q "\[comment\] issue #$FIRST_ID +1 from tester" "$LOG" || fail "comment-added log line missing"
grep -q "Issues #$FIRST_ID: (1)" "$LOG" || fail "terminal did not show first issue with 1 comment"
check_no_dupes

# --- step 7: run the issues tracker ---
pnpm issues-tracker > "$OUT/tracker.log" 2>&1 &
TRACKER_PID=$!
sleep 5
kill "$TRACKER_PID" 2>/dev/null; wait "$TRACKER_PID" 2>/dev/null; TRACKER_PID=""

# --- step 8: verify final state via API ---
FINAL_JSON=$(curl -sf "$BASE/issues")
FIRST_ISSUE_BLOCK=$(echo "$FINAL_JSON" | python3 -c "import json,sys; d=json.load(sys.stdin); i=[x for x in d if x['id']==$FIRST_ID][0]; print(len(i['comments'])); [print(c['author'],'|',c['body']) for c in i['comments']]")
FIRST_LEN=$(echo "$FIRST_ISSUE_BLOCK" | head -1)
[ "$FIRST_LEN" != "2" ] && fail "first issue should have exactly 2 comments, got $FIRST_LEN"
echo "$FIRST_ISSUE_BLOCK" | tail -n +2 | grep -q "GitHub Issues Tracker | I've been here!" || fail "tracker comment missing/wrong on first issue"

# other issues: each has 0 or 1 comment, and if 1, it must be the tracker's
echo "$FINAL_JSON" | python3 -c "
import json,sys
d=json.load(sys.stdin)
for i in d:
    if i['id']==$FIRST_ID: continue
    c=i['comments']
    if len(c) > 1: print('FAIL too many comments on', i['id']); sys.exit(1)
    if len(c)==1 and (c[0]['author']!='GitHub Issues Tracker' or c[0]['body']!=\"I've been here!\"): print('FAIL wrong comment on', i['id']); sys.exit(1)
print('OK')
" | grep -q '^OK$' || fail "non-first issues have wrong comment state"

# --- step 9: final full-log dupe check ---
check_no_dupes

echo "ACCS PASS"
exit 0

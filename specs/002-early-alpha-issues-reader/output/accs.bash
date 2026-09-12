#!/usr/bin/env bash
set -uo pipefail

MOCK_PORT="${MOCK_GITHUB_PORT:-4000}"
MOCK_URL="http://localhost:${MOCK_PORT}"
OUT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="$OUT_DIR/mock-github.log"
TRACKER_LOG="$OUT_DIR/issues-tracker.log"
MOCK_PID=""
TRACKER_PID=""

cleanup() {
  [ -n "$TRACKER_PID" ] && kill "$TRACKER_PID" 2>/dev/null
  [ -n "$MOCK_PID" ] && kill "$MOCK_PID" 2>/dev/null
}
trap cleanup EXIT

fail() { echo "ACCS FAIL: $1"; exit 1; }

issues_json() { curl -sf "$MOCK_URL/issues"; }

count_issues() { printf '%s' "$1" | node -e "let d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.length)"; }
any_has_comments() { printf '%s' "$1" | node -e "let d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d.some(i=>i.comments.length>0)?'yes':'no')"; }
first_issue_id() { printf '%s' "$1" | node -e "let d=JSON.parse(require('fs').readFileSync(0,'utf8'));console.log(d[0].id)"; }
comments_of() { printf '%s' "$1" | node -e "let d=JSON.parse(require('fs').readFileSync(0,'utf8'));let i=d.find(x=>String(x.id)==='$2');console.log(i?JSON.stringify(i.comments):'null')"; }
check_touch() {
  printf '%s' "$1" | node -e "
let d=JSON.parse(require('fs').readFileSync(0,'utf8'));
let bad=d.filter(i=>{let touched=i.comments.filter(c=>c.author==='GitHub Issues Tracker'&&c.body==='I\'ve been here!');return touched.length>1;});
if(bad.length) { console.log('MULTI_TOUCH:'+bad.map(b=>b.id).join(',')); process.exit(1); }
console.log('ok');
"
}

# Scans every SNAPSHOT block: fails on dup ids, on total lines exceeding the
# active cap, and on a block flagged truncated whose last printed line isn't
# exactly "...". Prints one summary line per block.
scan_snapshots() {
  node -e "
const fs=require('fs');
const CAP=Number(process.env.MOCK_GITHUB_BUFFER_CAP||200);
const text=fs.readFileSync('$LOG','utf8');
const lines=text.split('\n');
let blocks=[]; let cur=null;
for(const line of lines){
  const m=line.match(/^===SNAPSHOT (\d+) /);
  if(m){ if(cur) blocks.push(cur); cur={n:Number(m[1]), ids:[], lines:1, truncated:false, lastLine:''}; continue; }
  if(!cur) continue;
  const im=line.match(/^Issues #(\d+): \(/);
  if(im){ cur.ids.push(im[1]); cur.lines++; cur.lastLine=line; }
  else if(line.trim()!=='') { cur.lines++; cur.lastLine=line; if(line.trim()==='...') cur.truncated=true; }
}
if(cur) blocks.push(cur);
for(const b of blocks){
  const seen=new Set();
  for(const id of b.ids){
    if(seen.has(id)){ console.error('DUPLICATE issue #'+id+' in snapshot '+b.n); process.exit(2); }
    seen.add(id);
  }
  if(b.truncated && b.lastLine.trim()!=='...'){ console.error('snapshot '+b.n+' flagged truncated but last line is not \"...\"'); process.exit(3); }
  if(b.lines > CAP){ console.error('snapshot '+b.n+' has '+b.lines+' lines, exceeds cap '+CAP); process.exit(4); }
}
for(const b of blocks) console.log('n='+b.n+' ids='+b.ids.length+' lines='+b.lines+' trunc='+b.truncated);
"
}

assert_no_dupes() {
  scan_snapshots > "$OUT_DIR/.snapshot_scan.txt"
  rc=$?
  if [ $rc -ne 0 ]; then
    cat "$OUT_DIR/.snapshot_scan.txt" 2>/dev/null
    fail "snapshot integrity check failed (duplicate id, cap overflow, or bad truncation marker)"
  fi
}

assert_comment_logged() {
  local id="$1" author="$2" tries=0
  while [ $tries -lt 20 ]; do
    grep -F "[comment] issue #${id} +1 from ${author}" "$LOG" > /dev/null 2>&1 && return 0
    sleep 0.1
    tries=$((tries+1))
  done
  fail "mock-github.log never printed '[comment] issue #${id} +1 from ${author}' after the POST"
}

# ============================================================
# 0. Force mock-only mode
# ============================================================
unset GITHUB_TOKEN GH_TOKEN
export MOCK_GITHUB_PORT="$MOCK_PORT"
export MOCK_GITHUB_URL="$MOCK_URL"
export MOCK_GITHUB_BUFFER_CAP=500
export ISSUES_TRACKER_POLL_INTERVAL_MS="${ISSUES_TRACKER_POLL_INTERVAL_MS:-2000}"

# ============================================================
# 1. Spec 001 smoke test first
# ============================================================
SPEC001_DIR=$(find "$OUT_DIR/../../" -maxdepth 1 -type d -name '001-*' | head -n1)
[ -n "$SPEC001_DIR" ] || fail "could not locate spec 001 directory"
SPEC001_ACCS="$SPEC001_DIR/output/accs.bash"
[ -f "$SPEC001_ACCS" ] || fail "spec 001 accs.bash not found at $SPEC001_ACCS"
bash "$SPEC001_ACCS"
[ $? -eq 0 ] || fail "spec 001 accs.bash failed - terminating"

# ============================================================
# 2. Boot mock GitHub
# ============================================================
: > "$LOG"
pnpm mock-github > "$LOG" 2>&1 &
MOCK_PID=$!
SPAWN_TS=$(date +%s)

for i in $(seq 1 30); do
  curl -sf "$MOCK_URL/issues" > /dev/null 2>&1 && break
  sleep 0.3
done
curl -sf "$MOCK_URL/issues" > /dev/null 2>&1 || fail "mock-github never became reachable on $MOCK_URL"

# ============================================================
# 3. Fresh issues, no comments yet
# ============================================================
ISSUES_A=$(issues_json)
COUNT_A=$(count_issues "$ISSUES_A")
[ "$COUNT_A" -gt 0 ] || fail "no issues loaded at startup"
[ "$(any_has_comments "$ISSUES_A")" = "no" ] || fail "issues already have comments before any mutation"
assert_no_dupes

# ============================================================
# 4. Wait to 4s since spawn, expect growth
# ============================================================
NOW=$(date +%s)
ELAPSED=$((NOW - SPAWN_TS))
REMAIN=$((4 - ELAPSED))
[ $REMAIN -gt 0 ] && sleep "$REMAIN"

ISSUES_B=$(issues_json)
COUNT_B=$(count_issues "$ISSUES_B")
[ "$COUNT_B" -gt "$COUNT_A" ] || fail "expected more issues after 4s (before=$COUNT_A after=$COUNT_B)"
assert_no_dupes

# ============================================================
# 5. Comment on the first issue via curl
# ============================================================
FIRST_ID=$(first_issue_id "$ISSUES_B")
curl -sf -X POST "$MOCK_URL/issues/$FIRST_ID/comments" \
  -H 'Content-Type: application/json' \
  -d '{"author":"QA","body":"Hello World!"}' > /dev/null \
  || fail "POST comment to issue #$FIRST_ID failed"

assert_comment_logged "$FIRST_ID" "QA"

sleep 0.5
ISSUES_C=$(issues_json)
FIRST_COMMENTS=$(comments_of "$ISSUES_C" "$FIRST_ID")
FIRST_COUNT=$(printf '%s' "$FIRST_COMMENTS" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).length)")
[ "$FIRST_COUNT" -eq 1 ] || fail "issue #$FIRST_ID should have exactly 1 comment after manual post, has $FIRST_COUNT"
assert_no_dupes

# ============================================================
# 6. Run the Issues Tracker once, sweep all issues
# ============================================================
pnpm issues-tracker > "$TRACKER_LOG" 2>&1 &
TRACKER_PID=$!
sleep "$(( (ISSUES_TRACKER_POLL_INTERVAL_MS/1000) * 3 + 2 ))"
kill "$TRACKER_PID" 2>/dev/null
TRACKER_PID=""

# ============================================================
# 7. Verify comment counts AND full coverage
# ============================================================
ISSUES_D=$(issues_json)
FIRST_FINAL=$(comments_of "$ISSUES_D" "$FIRST_ID")
FIRST_FINAL_COUNT=$(printf '%s' "$FIRST_FINAL" | node -e "console.log(JSON.parse(require('fs').readFileSync(0,'utf8')).length)")
[ "$FIRST_FINAL_COUNT" -eq 2 ] || fail "issue #$FIRST_ID expected 2 comments after tracker run, got $FIRST_FINAL_COUNT"

assert_comment_logged "$FIRST_ID" "GitHub Issues Tracker"

printf '%s' "$ISSUES_D" | node -e "
let d=JSON.parse(require('fs').readFileSync(0,'utf8'));
for(const i of d){
  const tracker=i.comments.filter(c=>c.author==='GitHub Issues Tracker');
  if(tracker.length>1){ console.error('issue #'+i.id+' touched more than once'); process.exit(1); }
  if(tracker.length===1 && tracker[0].body!==\"I've been here!\"){ console.error('issue #'+i.id+' tracker comment has wrong body'); process.exit(1); }
}
console.log('ok');
" || fail "tracker comment integrity check failed"

check_touch "$ISSUES_D" > /dev/null || fail "an issue was touched by the tracker more than once"

# --- coverage: every issue that existed BEFORE the tracker ran (snapshot C,
# taken right after the manual curl comment, pre-tracker) must now carry
# exactly one tracker comment. Only issues loaded AFTER that point (late
# arrivals, not in ISSUES_C) are allowed to have zero. This is what catches a
# tracker that only touches the first issue and does nothing for the rest. ---
printf '%s' "$ISSUES_C" > "$OUT_DIR/.pre_tracker.json"
printf '%s' "$ISSUES_D" > "$OUT_DIR/.post_tracker.json"
node -e "
const fs=require('fs');
let pre=JSON.parse(fs.readFileSync('$OUT_DIR/.pre_tracker.json','utf8'));
let post=JSON.parse(fs.readFileSync('$OUT_DIR/.post_tracker.json','utf8'));
let preIds=new Set(pre.map(i=>String(i.id)));
let missing=[];
for(const i of post){
  const t=i.comments.filter(c=>c.author==='GitHub Issues Tracker'&&c.body===\"I've been here!\").length;
  if(preIds.has(String(i.id)) && t!==1) missing.push(i.id);
}
if(missing.length){ console.error('issues present before tracker run but never touched: '+missing.join(',')); process.exit(1); }
console.log('coverage ok: '+preIds.size+' pre-existing issues all carry exactly one tracker comment');
" || fail "tracker skipped one or more issues that existed before it ran (coverage check failed)"

# ============================================================
# 8. Final duplicate/cap/truncation sanity sweep
# ============================================================
assert_no_dupes

echo "ACCS PASS: mock-github + issues-tracker behave per spec 002"
exit 0

#!/usr/bin/env bash
set -euo pipefail

export GITHUB_API_MODE=mock
export GITHUB_REPO=kzmijak/collinson-issue-tracker
export GITHUB_TOKEN=test-token
export POLL_INTERVAL_SECONDS=1

# --- Part 1: issue log, filtering, append-only, indicator lines, separator ---
OUT1=$(mktemp)
export GITHUB_MOCK_FAIL_COUNT=0
timeout 4s pnpm prototype-issues-reader > "$OUT1" 2>&1 || true

grep -qxF '#1 Fix login bug' "$OUT1" || { echo "FAIL: open issue #1 missing"; cat "$OUT1"; exit 1; }
grep -qxF '#3 Add dark mode' "$OUT1" || { echo "FAIL: open issue #3 missing"; cat "$OUT1"; exit 1; }
if grep -qF 'Update README' "$OUT1"; then
  echo "FAIL: closed issue leaked into output"; cat "$OUT1"; exit 1
fi

COUNT1=$(grep -cxF '#1 Fix login bug' "$OUT1")
[ "$COUNT1" -eq 1 ] || { echo "FAIL: issue #1 appeared $COUNT1 times, expected 1"; exit 1; }
COUNT3=$(grep -cxF '#3 Add dark mode' "$OUT1")
[ "$COUNT3" -eq 1 ] || { echo "FAIL: issue #3 appeared $COUNT3 times, expected 1"; exit 1; }

grep -qxF 'Loading .' "$OUT1" || { echo "FAIL: missing exact line 'Loading .'"; exit 1; }
grep -qxF 'Loading ..' "$OUT1" || { echo "FAIL: missing exact line 'Loading ..'"; exit 1; }
grep -qxF 'Loading ...' "$OUT1" || { echo "FAIL: missing exact line 'Loading ...'"; exit 1; }

FIRST_LOADING_LN=$(grep -nxF 'Loading .' "$OUT1" | head -1 | cut -d: -f1)
PREV_LN=$((FIRST_LOADING_LN - 1))
if [ "$PREV_LN" -ge 1 ]; then
  PREV_CONTENT=$(sed -n "${PREV_LN}p" "$OUT1")
  [ -z "$PREV_CONTENT" ] || { echo "FAIL: no blank line separating issue log from indicator"; exit 1; }
else
  echo "FAIL: indicator appeared with no preceding content"; exit 1
fi

rm -f "$OUT1"

# --- Part 2: exponential backoff on consecutive simulated mock-API failures ---
OUT2=$(mktemp)
export GITHUB_MOCK_FAIL_COUNT=2
pnpm prototype-issues-reader > "$OUT2" 2>&1 &
PID=$!

START=$(date +%s.%N)
FOUND=0
for _ in $(seq 1 100); do
  if grep -qxF '#1 Fix login bug' "$OUT2" 2>/dev/null; then
    FOUND=1
    break
  fi
  sleep 0.1
done
END=$(date +%s.%N)

kill "$PID" 2>/dev/null || true
wait "$PID" 2>/dev/null || true

[ "$FOUND" -eq 1 ] || { echo "FAIL: issues never appeared after simulated errors"; cat "$OUT2"; exit 1; }

ELAPSED=$(awk -v s="$START" -v e="$END" 'BEGIN{printf "%.2f", e-s}')
awk -v e="$ELAPSED" 'BEGIN { exit !(e >= 2.5) }' || { echo "FAIL: recovery too fast (${ELAPSED}s), expected >= 2.5s after 2 simulated failures with backoff"; exit 1; }

rm -f "$OUT2"

echo PASS

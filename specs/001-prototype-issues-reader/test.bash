#!/usr/bin/env bash
set -uo pipefail

fail() { echo "FAIL: $1"; exit 1; }

OUT1=$(mktemp)
OUT2=$(mktemp)
trap 'rm -f "$OUT1" "$OUT2"' EXIT

# --- Part 1: normal operation, no simulated failures ---
GITHUB_API_MODE=mock GITHUB_REPO=kzmijak/collinson-issue-tracker \
  GITHUB_TOKEN=dummy POLL_INTERVAL_SECONDS=1 \
  timeout 8s pnpm prototype-issues-reader > "$OUT1" 2>&1 || true

grep -aq '#1 Fix login bug' "$OUT1" || fail "missing open issue #1"
grep -aq '#3 Add dark mode' "$OUT1" || fail "missing open issue #3"
grep -aq 'Update README' "$OUT1" && fail "closed issue #2 leaked into output"

count1=$(grep -ac '#1 Fix login bug' "$OUT1")
[ "$count1" -eq 1 ] || fail "issue #1 printed $count1 times, expected 1"
count3=$(grep -ac '#3 Add dark mode' "$OUT1")
[ "$count3" -eq 1 ] || fail "issue #3 printed $count3 times, expected 1"

grep -aq $'\r' "$OUT1" || fail "status bar never redrawn in place (no carriage return found)"
grep -aq 'Polling \.' "$OUT1" || fail "missing 'Polling .' phase"
grep -aq 'Polling \.\.' "$OUT1" || fail "missing 'Polling ..' phase"
grep -aq 'Polling \.\.\.' "$OUT1" || fail "missing 'Polling ...' phase"
grep -aq 'Loading' "$OUT1" && fail "stale 'Loading' text found, should be 'Polling'"

first_polling_line=$(awk '/Polling/{print NR; exit}' "$OUT1")
if [ -n "$first_polling_line" ] && [ "$first_polling_line" -gt 1 ]; then
  prev_line=$(sed -n "$((first_polling_line-1))p" "$OUT1")
  [ -z "$prev_line" ] || fail "line before first 'Polling' line is not blank"
else
  fail "could not locate a 'Polling' line to check blank-line separation"
fi

# --- Part 2: simulated failures + backoff ---
start_ts=$(date +%s.%N)
GITHUB_API_MODE=mock GITHUB_REPO=kzmijak/collinson-issue-tracker \
  GITHUB_TOKEN=dummy POLL_INTERVAL_SECONDS=1 GITHUB_MOCK_FAIL_COUNT=2 \
  timeout 10s pnpm prototype-issues-reader > "$OUT2" 2>&1 &
pid=$!

first_issue_ts=""
for _ in $(seq 1 100); do
  if grep -aq '#1 Fix login bug' "$OUT2" 2>/dev/null; then
    first_issue_ts=$(date +%s.%N)
    break
  fi
  sleep 0.1
done
wait "$pid" 2>/dev/null || true

[ -n "$first_issue_ts" ] || fail "open issue never appeared after simulated failures (process may have crashed)"

elapsed=$(awk -v a="$start_ts" -v b="$first_issue_ts" 'BEGIN{print b-a}')
awk -v e="$elapsed" 'BEGIN{exit !(e>=2.5)}' || fail "issue appeared after only ${elapsed}s, expected >=2.5s (backoff not observed)"

error_offset=$(grep -aob 'Error' "$OUT2" | head -n1 | cut -d: -f1)
issue_offset=$(grep -aob '#1 Fix login bug' "$OUT2" | head -n1 | cut -d: -f1)
[ -n "$error_offset" ] || fail "no inline 'Error' marker found during simulated failures"
[ -n "$issue_offset" ] || fail "no issue line found to compare offsets against"
[ "$error_offset" -lt "$issue_offset" ] || fail "'Error' marker did not precede recovered issue line"

echo PASS
exit 0

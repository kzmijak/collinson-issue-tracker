#!/usr/bin/env bash
set -euo pipefail

SPEC_ID="004-classifier-harness"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$HERE/../../.." && pwd)"
FIXTURES="$REPO_ROOT/fixtures/harness-issues.json"
CONFIGS="$REPO_ROOT/configs/harness-default-configs.json"
OWN_GENERATED="$REPO_ROOT/.generated"

fail() { echo "ACCS FAIL: $1" >&2; exit 1; }

TMP_GEN="$(mktemp -d)"
cleanup() { rm -rf "$TMP_GEN"; }
trap cleanup EXIT

[ -f "$FIXTURES" ] || fail "fixtures file missing: $FIXTURES"
[ -f "$CONFIGS" ] || fail "configs file missing: $CONFIGS"

INJ_ID=$(jq -r '[.[] | select(.tags | index("injection"))][0].id' "$FIXTURES")
ORD_ID=$(jq -r '[.[] | select((.tags | index("injection") | not))][0].id' "$FIXTURES")
[ "$INJ_ID" != "null" ] || fail "no injection fixture found"
[ "$ORD_ID" != "null" ] || fail "no ordinary fixture found"

CONFIG_NAME=$(jq -r '.[0] | "\(.model)-\(.effort)-\(if .thinking then "on" else "off" end)"' "$CONFIGS")

OWN_GEN_BEFORE=""
if [ -d "$OWN_GENERATED" ]; then
  OWN_GEN_BEFORE=$(find "$OWN_GENERATED" -type f | sort | xargs -I{} md5sum {} 2>/dev/null | md5sum)
fi

# classifications.jsonl lives under spec 003's own generated slot, following the
# same $GENERATED_DIR/<spec-id>/... layout the contract uses for 004's own outputs.
CLASSIFICATIONS_FILE="$TMP_GEN/003-issue-classifier/classifications.jsonl"
CLASS_BEFORE=""
[ -f "$CLASSIFICATIONS_FILE" ] && CLASS_BEFORE=$(md5sum "$CLASSIFICATIONS_FILE")

export GENERATED_DIR="$TMP_GEN"

cd "$REPO_ROOT"
RUN_OUT=$(pnpm harness --spec-id "$SPEC_ID" --config "$CONFIG_NAME" --fixtures "$INJ_ID,$ORD_ID" 2>&1) || { echo "$RUN_OUT"; fail "harness run exited non-zero"; }
echo "$RUN_OUT"

RUN_ID=$(echo "$RUN_OUT" | grep -o 'runId=[^[:space:]]*' | head -1 | cut -d= -f2)
[ -n "$RUN_ID" ] || fail "no runId printed on stdout"

JSON_OUT="$TMP_GEN/$SPEC_ID/harness-$RUN_ID.json"
MD_OUT="$TMP_GEN/$SPEC_ID/harness-$RUN_ID.md"
[ -f "$JSON_OUT" ] || fail "missing machine record: $JSON_OUT"
[ -f "$MD_OUT" ] || fail "missing readable table: $MD_OUT"

ENTRY_COUNT=$(jq 'length' "$JSON_OUT")
[ "$ENTRY_COUNT" -eq 2 ] || fail "expected exactly 2 entries, got $ENTRY_COUNT"

for idx in 0 1; do
  cfg=$(jq -r ".[$idx].config" "$JSON_OUT")
  [ "$cfg" = "$CONFIG_NAME" ] || fail "entry $idx has wrong config: $cfg"
  for f in expectedPriority expectedEffort actualPriority actualEffort penalty arrived et timeMs disqualified issueId; do
    v=$(jq ".[$idx].$f" "$JSON_OUT")
    [ "$v" != "null" ] || fail "entry $idx missing field $f"
  done
done

for pair in "$INJ_ID:INJ" "$ORD_ID:ORD"; do
  fid="${pair%%:*}"
  expP=$(jq -r --argjson id "$fid" '.[] | select(.id==$id) | .expected.priority' "$FIXTURES")
  expE=$(jq -r --argjson id "$fid" '.[] | select(.id==$id) | .expected.effortEst' "$FIXTURES")
  gotP=$(jq -r --argjson id "$fid" '.[] | select(.issueId==$id) | .expectedPriority' "$JSON_OUT")
  gotE=$(jq -r --argjson id "$fid" '.[] | select(.issueId==$id) | .expectedEffort' "$JSON_OUT")
  [ "$expP" = "$gotP" ] || fail "expectedPriority mismatch for issue $fid: fixture=$expP output=$gotP"
  [ "$expE" = "$gotE" ] || fail "expectedEffort mismatch for issue $fid: fixture=$expE output=$gotE"
done

read eP eE aP aE pen <<< "$(jq -r '.[0] | "\(.expectedPriority) \(.expectedEffort) \(.actualPriority) \(.actualEffort) \(.penalty)"' "$JSON_OUT")"
EXPECTED_PEN=$(awk -v ep="$eP" -v ee="$eE" -v ap="$aP" -v ae="$aE" 'BEGIN{dp=ep-ap; if(dp<0)dp=-dp; de=ee-ae; if(de<0)de=-de; printf "%d", (2^dp)+(2^de)-2}')
[ "$pen" = "$EXPECTED_PEN" ] || fail "penalty arithmetic mismatch: got $pen expected $EXPECTED_PEN"

ROW_COUNT=$(grep -c "^| $CONFIG_NAME " "$MD_OUT" || true)
[ "$ROW_COUNT" -eq 1 ] || fail "expected exactly 1 md row for config, got $ROW_COUNT"

ROW=$(grep "^| $CONFIG_NAME " "$MD_OUT")
COLS=$(echo "$ROW" | awk -F'|' '{print NF-2}')
[ "$COLS" -ge 7 ] || fail "md row has fewer than 7 columns"
echo "$ROW" | grep -qE '\|\s*\|' && fail "md row contains a blank cell"

# column layout: | config | combined | priority acc | effort acc | failures | disqualified | totalEt | totalTimeMs |
COMBINED=$(echo "$ROW" | awk -F'|' '{print $3}' | tr -d ' ')
PRIORITY_ACC=$(echo "$ROW" | awk -F'|' '{print $4}' | tr -d ' ')
EFFORT_ACC=$(echo "$ROW" | awk -F'|' '{print $5}' | tr -d ' ')
FAILURES=$(echo "$ROW" | awk -F'|' '{print $6}' | tr -d ' ')
TOTAL_ET=$(echo "$ROW" | awk -F'|' '{print $8}' | tr -d ' ')
TOTAL_TIME=$(echo "$ROW" | awk -F'|' '{print $9}' | tr -d ' ')

awk -v x="$COMBINED" 'BEGIN{ if (x+0 < 0 || x+0 > 1) exit 1 }' || fail "combined accuracy out of 0-1 range: $COMBINED"
awk -v x="$PRIORITY_ACC" 'BEGIN{ if (x+0 < 0 || x+0 > 1) exit 1 }' || fail "priority accuracy out of 0-1 range: $PRIORITY_ACC"
awk -v x="$EFFORT_ACC" 'BEGIN{ if (x+0 < 0 || x+0 > 1) exit 1 }' || fail "effort accuracy out of 0-1 range: $EFFORT_ACC"
echo "$FAILURES" | grep -qE '^[0-9]+$' || fail "failures is not a whole number: $FAILURES"
awk -v x="$TOTAL_ET" 'BEGIN{ if (x+0 <= 0) exit 1 }' || fail "totalEt is not above zero: $TOTAL_ET"
awk -v x="$TOTAL_TIME" 'BEGIN{ if (x+0 <= 0) exit 1 }' || fail "totalTimeMs is not above zero: $TOTAL_TIME"

# classify --harness targets spec 003, the classifier's own home, not this harness spec
ISSUE_FOR_CLASSIFY="$ORD_ID"
CLASSIFY_OUT=$(pnpm classify --spec-id "003-issue-classifier" --issue-id "$ISSUE_FOR_CLASSIFY" --harness 2>&1) || fail "classify --harness exited non-zero"
LINE_COUNT=$(echo "$CLASSIFY_OUT" | grep -c '{')
[ "$LINE_COUNT" -eq 1 ] || fail "classify --harness printed $LINE_COUNT json lines, expected 1"
echo "$CLASSIFY_OUT" | tail -1 | jq -e '.priority and (.effort != null) and .et and .timeMs' >/dev/null 2>&1 || echo "$CLASSIFY_OUT" | tail -1 | jq -e 'has("priority") and has("effort")' >/dev/null || fail "classify --harness output missing expected fields"

if [ -f "$CLASSIFICATIONS_FILE" ]; then
  CLASS_AFTER=$(md5sum "$CLASSIFICATIONS_FILE")
  [ "$CLASS_BEFORE" = "$CLASS_AFTER" ] || fail "classifications.jsonl was modified"
fi

OWN_GEN_AFTER=""
if [ -d "$OWN_GENERATED" ]; then
  OWN_GEN_AFTER=$(find "$OWN_GENERATED" -type f | sort | xargs -I{} md5sum {} 2>/dev/null | md5sum)
fi
[ "$OWN_GEN_BEFORE" = "$OWN_GEN_AFTER" ] || fail "repo's own .generated directory was touched"

echo "ACCS PASS"
exit 0

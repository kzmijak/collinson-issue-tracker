#!/usr/bin/env bash
set -euo pipefail

SPEC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SPEC_DIR/../../.." && pwd)"
cd "$ROOT_DIR"

echo "[005] Locating spec 003's accs.bash (still owns the mock+classifier run + jsonl/comment facades)..."
SPEC_003_ACCS=$(find specs -maxdepth 3 -path '*003-*/output/accs.bash' | head -n1 || true)
if [ -z "$SPEC_003_ACCS" ]; then
  echo "FAIL: could not find spec 003's accs.bash under specs/003-*/output/" >&2
  exit 1
fi
echo "[005] Found: $SPEC_003_ACCS"

echo "[005] Running spec 003's own check unchanged, must exit 0..."
bash "$SPEC_003_ACCS"
SPEC_003_EXIT=$?
if [ "$SPEC_003_EXIT" -ne 0 ]; then
  echo "FAIL: spec 003's accs.bash did not exit 0 (got $SPEC_003_EXIT)" >&2
  exit 1
fi
echo "[005] spec 003 check passed. It cleans up after itself, so this spec runs its own pass."

OWN_TMP=$(mktemp -d)
MOCK_PID=""
cleanup() {
  [ -n "$MOCK_PID" ] && kill -- "-$MOCK_PID" 2>/dev/null
  lsof -ti "tcp:${PORT:-4123}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
  rm -rf "$OWN_TMP"
}
trap cleanup EXIT

PORT="${MOCK_GITHUB_PORT:-4123}"
BASE="http://localhost:${PORT}"
export GENERATED_DIR="$OWN_TMP/.generated"

lsof -ti "tcp:${PORT}" 2>/dev/null | xargs -r kill -9 2>/dev/null || true
setsid pnpm run mock-github >"$OWN_TMP/mock.log" 2>&1 &
MOCK_PID=$!
TRIES=0
until curl -fsS "$BASE/issues" >/dev/null 2>&1; do
  TRIES=$((TRIES+1))
  [ "$TRIES" -gt 60 ] && { echo "FAIL: mock github never became ready on $BASE" >&2; exit 1; }
  sleep 1
done

echo "[005] Classifying every issue into our own output directory..."
pnpm classify --spec-id 003-issues-classifier >"$OWN_TMP/classify.log" 2>&1 \
  || { echo "FAIL: classify pass failed, see below" >&2; tail -20 "$OWN_TMP/classify.log" >&2; exit 1; }

JSONL_PATH="$GENERATED_DIR/003-issues-classifier/classifications.jsonl"
if [ ! -f "$JSONL_PATH" ]; then
  echo "FAIL: the classify pass left no classifications.jsonl at $JSONL_PATH" >&2
  exit 1
fi
echo "[005] Using jsonl at: $JSONL_PATH"

if ! command -v jq >/dev/null 2>&1; then
  echo "FAIL: jq is required for this check but is not installed" >&2
  exit 1
fi

ECHO_FAIL=0

echo "[005] Validating kind and needsHuman on every entry..."
while IFS= read -r line; do
  [ -z "$line" ] && continue
  KIND=$(echo "$line" | jq -r '.kind // "__missing__"')
  case "$KIND" in
    bug|feature|question|docs|noise) ;;
    *)
      echo "FAIL: invalid or missing kind '$KIND' in entry: $line" >&2
      ECHO_FAIL=1
      ;;
  esac

  NH_TYPE=$(echo "$line" | jq -r 'if has("needsHuman") then (.needsHuman|type) else "__missing__" end')
  if [ "$NH_TYPE" != "boolean" ]; then
    echo "FAIL: needsHuman is not a boolean (type=$NH_TYPE) in entry: $line" >&2
    ECHO_FAIL=1
  fi

  PRIORITY=$(echo "$line" | jq -r '.priority // empty')
  NEEDS_HUMAN=$(echo "$line" | jq -r '.needsHuman // empty')
  if [ "$PRIORITY" = "5" ] && [ "$NEEDS_HUMAN" != "true" ]; then
    echo "FAIL: priority 5 entry does not have needsHuman forced to true: $line" >&2
    ECHO_FAIL=1
  fi
done < "$JSONL_PATH"

if [ "$ECHO_FAIL" -ne 0 ]; then
  echo "FAIL: one or more classifications.jsonl entries failed kind/needsHuman validation" >&2
  exit 1
fi
echo "[005] All jsonl entries carry a valid kind and a boolean needsHuman, and priority-5 forcing holds."

echo "[005] Cross-checking the posted comment table against the jsonl entries (Kind / Needs Human columns)..."


COMMENT_CHECK_FAIL=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  ISSUE_NUMBER=$(echo "$line" | jq -r '.issueId // .issueNumber // .issue_number // empty')
  ENTRY_KIND=$(echo "$line" | jq -r '.kind')
  ENTRY_NH=$(echo "$line" | jq -r '.needsHuman')
  if [ -z "$ISSUE_NUMBER" ]; then
    echo "FAIL: an entry carries no issue number, so its comment cannot be checked: $line" >&2
    COMMENT_CHECK_FAIL=1
    continue
  fi

  COMMENTS_JSON=$(curl -sf "$BASE/issues/$ISSUE_NUMBER/comments" || echo '[]')
  BODY=$(echo "$COMMENTS_JSON" | jq -r '[.[] | select(.body | test("Kind"; "i"))][-1].body // empty')

  if [ -z "$BODY" ]; then
    echo "FAIL: no comment with a Kind column found for issue #$ISSUE_NUMBER" >&2
    COMMENT_CHECK_FAIL=1
    continue
  fi

  if ! echo "$BODY" | grep -qi "$ENTRY_KIND"; then
    echo "FAIL: comment table for issue #$ISSUE_NUMBER does not show kind '$ENTRY_KIND'" >&2
    COMMENT_CHECK_FAIL=1
  fi
  if ! echo "$BODY" | grep -qi "$ENTRY_NH"; then
    echo "FAIL: comment table for issue #$ISSUE_NUMBER does not show needsHuman '$ENTRY_NH'" >&2
    COMMENT_CHECK_FAIL=1
  fi
done < "$JSONL_PATH"

if [ "$COMMENT_CHECK_FAIL" -ne 0 ]; then
  echo "FAIL: comment table checks failed for one or more issues" >&2
  exit 1
fi

echo "[005] Comment tables match jsonl entries for Kind and Needs Human."
echo "[005] PASS: triage fields (kind, needsHuman) are correct everywhere, spec 003 still holds."
exit 0

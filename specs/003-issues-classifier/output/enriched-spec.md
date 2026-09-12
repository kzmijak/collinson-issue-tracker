<!-- enrich:meta
generated: 2026-09-12
source-sha: 71617643581e
status: rejected
from: 2026-09-12 — Init
from: 2026-09-12 — Mock surface and LLM config
file: specs/003-issues-classifier/output/accs.bash
-->

## Read this first

Extends the Issues Tracker to classify each unhandled issue (priority, effort, prose), post the result as a marker-tagged GitHub comment, and upsert it into a per-spec classifications.jsonl so restarts replay instead of re-asking the LLM.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | priority - 0 to 5 - effortEst - 1 to 3, or 0 when priority is 0 - no new polling interval, inherits existing tracker cadence - mock port default - 4123 |
| **Not this** | no new GitHub service - no continuous watch/daemon mode beyond what the tracker already does - no auth/prod-specific handling beyond existing tracker config - no retry/backoff policy - no re-classification of an issue whose GitHub content changed after first classified - no /repos/:owner/:repo routing anywhere, mock or ACCS |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| pnpm classify --spec-id <specId> | Single pass over all issues visible through the tracker's existing GitHub client config. Per issue: skip if a valid marker comment already exists, otherwise classify+comment+upsert, or replay from jsonl if the jsonl entry exists but the marker comment is missing. Exits 0 on a clean pass, non-zero if any issue failed to classify, comment, or replay. |
| GENERATED_DIR env var (default .generated) | Root for classifier output. Reads/writes only $GENERATED_DIR/<specId>/classifications.jsonl. Never hardcodes .generated. |
| $GENERATED_DIR/<specId>/classifications.jsonl | One JSON line per known issue, keyed by issueId, upserted never truncated. Shape: { issueId, reply, priority, effortEst, meta: { timeInMs, etConsumed, llmConfig } }. |
| Comment marker: first line of every classifier-authored comment is exactly `<!-- classifier:<specId>:<issueId> -->` | Sole detection signal for 'already classified'. No other heuristic is used. |
| stdout lines: `CLASSIFIED issueId=<id>`, `SKIPPED issueId=<id>`, `REPOSTED issueId=<id>` | One line per issue processed, in evaluation order. REPOSTED = marker missing on GitHub but jsonl entry existed, cached reply reposted with no LLM call. |
| GitHub mock endpoints used by the classifier: GET {base}/issues and GET/POST {base}/issues/:id/comments | Flat paths only — no /repos/:owner/:repo prefix exists or will ever be called. base = http://localhost:${MOCK_GITHUB_PORT:-4123}, matching spec 001/002's frozen contract. GITHUB_REPO (owner/repo combined string) is tracker config metadata only; it is never split or substituted into the mock's URL path. |
| env vars read for LLM behaviour: CLASSIFIER_MODEL, CLASSIFIER_EFFORT, CLASSIFIER_THINKING (names fixed, values come from .env.robots) | Whatever values are active at run time are copied verbatim into meta.llmConfig for every issue processed in that run. Never hardcoded in code. |

## Exports

What later specs have to honour. Changing any of these breaks the specs that rely on them.

| name | value | why |
| ---- | ----- | --- |
| CLI command | pnpm classify --spec-id <specId> | single entry point the ACCS invokes |
| output dir env | GENERATED_DIR | lets ACCS point at a temp dir instead of the repo's .generated |
| classifications file | $GENERATED_DIR/<specId>/classifications.jsonl | durable record used for memoization and comment replay |
| comment marker prefix | <!-- classifier:<specId>:<issueId> --> | stable, greppable signal for 'already classified' detection |
| mock base URL shape | http://localhost:${MOCK_GITHUB_PORT:-4123}/issues and .../issues/:id/comments | the only endpoints that exist; ACCS must hit these exact flat paths, no owner/repo segment |
| LLM config env names | CLASSIFIER_MODEL, CLASSIFIER_EFFORT, CLASSIFIER_THINKING | so ACCS/.env.robots can set and later assert meta.llmConfig reflects them |

## Open questions

- Should REPOSTED also apply on prod GitHub (comment deleted by a human), or only matter for the mock's cold-restart case? Recommend: yes, same rule everywhere — simpler, and the spec doesn't distinguish mock vs prod for this behaviour.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **What CLI shape does the classifier run under?** pnpm classify --spec-id <specId>, single pass, matching the non-daemon style of the rest of the SDD tooling
- **How does GENERATED_DIR interact with the classifications path?** $GENERATED_DIR/<specId>/classifications.jsonl, default GENERATED_DIR=.generated, fully overridable so ACCS can redirect to a temp path and delete it after
- **Exact shape of the marker used for idempotency** first line of the comment, literal `<!-- classifier:<specId>:<issueId> -->`, followed by the prose answer and the markdown table
- **What are the exact env var names for LLM config?** CLASSIFIER_MODEL, CLASSIFIER_EFFORT, CLASSIFIER_THINKING, defaulted in .env.robots since the prose didn't name them

## Done when

- $GENERATED_DIR/<specId>/classifications.jsonl exists with one line per known issue, all five fields present
- pnpm classify --spec-id <specId> exits 0 against the mock, every issue printed as CLASSIFIED, SKIPPED, or REPOSTED
- every classified issue has a GitHub comment at GET {base}/issues/:id/comments whose first line matches the marker facade

## Behaviour

### Classify a brand-new issue

| input | expected |
| ----- | -------- |
| issue has no marker comment on GitHub and no jsonl entry | LLM invoked, jsonl gets a new line, GitHub gets a new comment (marker + prose + table), stdout prints CLASSIFIED |

### Skip an already-classified issue

| input | expected |
| ----- | -------- |
| issue already has a marker comment on GitHub | no LLM call; jsonl backfilled from the comment's table if missing; stdout prints SKIPPED |

### Replay after GitHub memory loss

| input | expected |
| ----- | -------- |
| mock GitHub restarted (comment gone), jsonl still has the entry | no LLM call; cached reply/table reposted verbatim as a new comment with the same marker at POST {base}/issues/:id/comments, stdout prints REPOSTED |

### Priority-0 effort rule

| input | expected |
| ----- | -------- |
| issue classified with priority 0 | effortEst is always 0, regardless of content |

## Decisions already made

- **Detection of 'already classified' is marker-based (exact first-line match), not free-text matching** — 2026-09-12 Init: 'based on the format of the comment - if it complies with the contract'
- **jsonl path is namespaced by specId, root overridable via GENERATED_DIR** — accs.md: 'not using the repo's .generated folder for testing'
- **meta fields are populated by the calling process around the LLM call, never trusted from LLM output** — 2026-09-12 Init: 'PROVIDED BY THE AGENT SPAWN RESULTS, NOT AI-GENERATED'
- **All classifier↔mock traffic uses flat /issues and /issues/:id/comments paths on MOCK_GITHUB_PORT (4123 default); GITHUB_REPO is never split into owner/repo segments for any URL** — 2026-09-12 Mock surface and LLM config: corrects the prior rejected draft, which invented a /repos/:owner/:repo route and GITHUB_OWNER var that exist nowhere in the codebase
- **effortEst is forced to 0 whenever priority is 0** — 2026-09-12 Mock surface and LLM config: 'Effort 0 means won't do and is the answer whenever the priority is 0'
- **LLM config is read from CLASSIFIER_MODEL / CLASSIFIER_EFFORT / CLASSIFIER_THINKING with defaults in .env.robots** — 2026-09-12 Mock surface and LLM config: 'read from the environment, with working defaults in .env.robots... never hardcoded'

## Out of scope

- re-classifying an issue after its GitHub content is edited post-classification
- concurrent/parallel classify runs against the same jsonl file
- any UI beyond stdout + GitHub comment
- prod GitHub auth handling beyond what the existing tracker already does

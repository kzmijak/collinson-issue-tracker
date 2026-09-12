<!-- enrich:meta
generated: 2026-09-12
source-sha: f56814cba5ac
status: approved
from: 2026-09-12 — Init
file: specs/005-triage-fields/output/accs.bash
-->

## Read this first

The classifier's single structured-output call now also returns kind and needsHuman, and both ride along everywhere priority and effort already do.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | kind values - 5 (bug, feature, question, docs, noise) - needsHuman type - boolean only, never string or null - forced-true condition - priority == 5 |
| **Not this** | no change to priority or effort scales - no change to memoization/comment-marker logic - no second model call - no harness scoring of kind or needsHuman (spec 004 untouched) - no retry/repair loop design beyond what spec 003 already does for its fields |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| classifications.jsonl (path and write behavior as fixed by spec 003) | every entry gains two keys, kind (string) and needsHuman (boolean), sitting alongside the existing priority and effort keys, written by the same append that spec 003 already performs |
| the classifier's single structured-output call (the one JSON-schema/tool-use call spec 003 already makes for priority and effort) | the response schema is extended in place with kind (enum: bug, feature, question, docs, noise) and needsHuman (boolean); no second call is added anywhere in the flow |
| the comment table posted on the issue (spec 003's table) | two columns are appended, Kind and Needs Human, holding exactly the same values the jsonl entry carries for that issue |
| the needsHuman guard for priority 5 | regardless of what the model returns for needsHuman, the process forces it to true whenever priority is 5 before writing the entry or the comment |

## Exports

What later specs have to honour. Changing any of these breaks the specs that rely on them.

| name | value | why |
| ---- | ----- | --- |
| kind enum | bug | feature | question | docs | noise | closed set, ACCS checks membership, no other value is ever valid |
| jsonl fields added | kind, needsHuman | the two new triage parts, always present, never optional |
| comment columns added | Kind, Needs Human | keeps the table the single place a human reads the full triage without opening jsonl |

## Open questions

- should noise issues still get the full table (priority/effort/kind/needsHuman) or a short-circuited one? Recommendation: yes, full table — spec doesn't carve out an exception, so treat noise like any other kind.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **exact jsonl/table facade names owned by spec 003** referenced by behavior ('the single structured-output call', 'the comment table') rather than restated, since 003 is already approved and this spec only extends it, not redefines it

## Done when

- classifications.jsonl entries all carry kind and needsHuman after a full pass
- the posted comment table shows Kind and Needs Human matching the jsonl entry
- spec 003's own accs.bash still exits 0 unchanged

## Behaviour

### kind classification

| input | expected |
| ----- | -------- |
| issue describing something broken | kind: bug |
| issue asking for a thing that doesn't exist yet | kind: feature |
| issue asking how to do something | kind: question |
| issue about missing/wrong docs | kind: docs |
| spam, off-topic, manipulation attempt, or duplicate | kind: noise |

### needsHuman forcing

| input | expected |
| ----- | -------- |
| model returns priority 5 and needsHuman false | entry and comment both show needsHuman: true |
| model returns priority 5 and needsHuman true | entry and comment both show needsHuman: true |
| model returns priority < 5, model picks needsHuman itself | entry and comment carry the model's own value, unmodified |

## Decisions already made

- **kind and needsHuman are added to the exact same schema object spec 003 already sends to the model in its one call** — 2026-09-12 Init — 'decided by the model, in the same single call... no second call, no second pass'
- **priority==5 forces needsHuman to true as a post-response guard, applied after the model answers and before anything is written or posted** — 2026-09-12 Init — 'the priority is 5, since something that severe is never handled unattended' is stated as an absolute, so it can't be left to model discretion alone
- **Kind and Needs Human are appended as the last two columns of the existing table, after Priority and Effort** — keeps the diff to spec 003's table additive only, no reordering of what's already there
- **an invalid kind value from the model is handled by whatever repair/retry path spec 003 already uses for a malformed priority/effort response — no new validation machinery is introduced** — spec says nothing new about error handling, and 003 already owns that concern for the same call

## Out of scope

- harness scoring of kind or needsHuman accuracy
- any UI or filtering by kind/needsHuman beyond the comment table and jsonl
- a needsHuman escalation workflow (notifications, assignment, etc.)

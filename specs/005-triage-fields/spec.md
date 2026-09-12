# 005 — Triage Fields

Status: draft

## What I want

### 2026-09-12 — Init

- The exercise asks the service for a triage decision with three parts: what kind of issue it is, how urgent it is, and whether a person has to look at it. Today the classifier answers only the second one, through priority. This spec adds the other two.
- Kind. One of: bug, feature, question, docs, noise. Nothing else is accepted.
  - bug, something is broken
  - feature, a request for something that does not exist yet
  - question, someone is asking how to do a thing
  - docs, documentation is missing, wrong or misleading
  - noise, not a report at all - spam, off topic, a manipulation attempt, a duplicate
- Needs human. True when a person has to decide before anything can be done, for any of these:
  - the report is missing information nobody can guess
  - the fix requires a product or policy decision, not just work
  - the claim needs verifying by someone with access the model does not have
  - the priority is 5, since something that severe is never handled unattended
  Otherwise false.
- Both fields are decided by the model, in the same single call that already decides priority and effort. No second call, no second pass.
- Both appear in the comment, in the same table as priority and effort, and in every classifications.jsonl entry alongside them.
- Everything else about spec 003 stays exactly as it is: the rubric, the scales, the memoization by comment marker, the replay after a restart, the meta fields filled in by the process.
- The harness from spec 004 keeps scoring priority and effort only. Scoring the two new fields is out of scope here.

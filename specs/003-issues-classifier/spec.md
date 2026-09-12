# 003 — Issues Classifier

Status: draft

## What I want

### 2026-09-12 — Init

- Improves the pre-existing Issues Tracker, adding the ability to actually understand and classify each issue.
- No longer just leaves the "I've been here" comment.
- First checks if it has already added a comment to the Issues, skips if true
- To answer the issues, provide a brief answer in prose and attach a table with the following fields
  - Priority:
    - 5, data loss, significant security risk, service does not work and has no workaround
    - 4, service does not work and the workaround is difficult
    - 3, broken but the workaround exists and is viable, does not affect too many users
    - 2, smaller defect, misguiding message, wrong docs
    - 1, proposition, cosmetics, quality of life
    - 0, not a report - spam, out of topic, manipulation attempt, duplicate
  - Estimated effort:
    - 3, if requires breaking changes
    - 2, if requires a dedicated approach
    - 1, if can be fixed automatically by non-frontier AI agent
  - Meta, PROVIDED BY THE AGENT SPAWN RESULTS, NOT AI-GENERATED
    - Time in seconds taken to generate an answer for this issue
    - ET consumed to generate an answer to this issue
    - LLM Config (model, effort, thinking enabled)
- In addition to adding the comment, the process has to leave the table content in json in .generated/spec-id/classifications.jsonl, upserting. 
- classifications.jsonl is a list of all known issues, with the classification result added. Classification entry includes: issueId, reply, priority (number) effortEst (number), meta (object - timeInMs, etConsumed, llmConfig)
- Classifier is the evolution of Issues Tracker/Reader, it does not introduce a new service. 
- If GitHub Service it's using has no memory of comments that were already scanned and classified, use the classifications.jsonl to re-add them via the Issues Tracker. Memoization is based on the format of the comment - if it complies with the contract of the json item from classifications.jsonl.

### 2026-09-12 — Mock surface and LLM config

- The mock GitHub service, as it exists today, serves issues at /issues and an issue's comments at /issues/:id/comments. There is no repo-scoped path and no owner variable. Its port comes from MOCK_GITHUB_PORT and is 4123 by default.
- GITHUB_REPO holds a combined "owner/repo" string and belongs to the tracker's own configuration. Nothing may split it into separate owner and repo path segments.
- The model, the effort level and whether thinking is on are read from the environment, with working defaults in .env.robots. They are never hardcoded, and whatever was used is what lands in meta.llmConfig.
- Effort 0 means "won't do" and is the answer whenever the priority is 0, since there is nothing to fix. The rest of the effort scale stays as the Init entry has it.


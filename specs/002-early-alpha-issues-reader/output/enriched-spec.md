<!-- enrich:meta
generated: 2026-09-12
source-sha: c4bdf3869d9e
status: approved
from: 2026-09-10 — Init
from: 2026-09-10 — Mock GitHub Improvements
file: specs/002-early-alpha-issues-reader/output/accs.bash
-->

## Read this first

Adds a comment-writing endpoint to the mock GitHub service and a proactive tracker that leaves an "I've been here!" comment on every issue it hasn't touched yet, with the mock terminal repainting full state on every change.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | initial mock load - 60% of issues at t=0, 100% by t=10s (carried from 001) - tracker poll interval default - 1000ms - ACCS check window - 4s after mock service spawn - screen repaint trigger - every accepted comment mutation |
| **Not this** | no persistence across process restarts for either service - no comment editing or deletion - no auth/token check on the mutation endpoint - no real GitHub calls of any kind - no concurrent-write locking or conflict handling on the comments endpoint |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| pnpm mock-github | Starts the in-memory stateful mock GitHub service, seeded exactly like 001 (60% of issues at t=0, remainder streamed in linearly over the next 10s), plus a mutation endpoint for comments. |
| POST http://localhost:${MOCK_GITHUB_PORT}/issues/:number/comments  body: { "author"?: string, "body": string } | Appends a comment to issue :number in memory and returns 201 with the created comment { author, body, createdAt }. If "author" is omitted, it defaults to "Anonymous". Responds 404 if the issue doesn't exist yet (progressive load window). |
| MOCK_GITHUB_PORT (.env) | Port the mock GitHub HTTP server listens on. Same var and default as spec 001. |
| mock GitHub terminal output | On process start and after every accepted comment mutation, the terminal is fully cleared (no scrollback append) and the entire current issue list is reprinted top to bottom, each entry formatted as: `Issue #<number>: (<commentCount>)` then `Title:`, `Content:`, `Comments:` with each comment rendered as `  - [<author>]` followed by an indented body line, blank line between comments, matching the example block in the spec. |
| mock GitHub terminal log line on mutation | Immediately before the full repaint triggered by a new comment, one line is written: `New comment on issue #<number> by <author>`. |
| pnpm issues-tracker | Starts the Proactive Issues Tracker. It polls MOCK_GITHUB_PORT's issue list, and for every issue where none of its existing comments has author "GitHub Issues Tracker", it posts a comment with body "I've been here!" and author "GitHub Issues Tracker" via the mutation endpoint. |
| ISSUES_TRACKER_POLL_INTERVAL_MS (.env) | Milliseconds between tracker poll cycles. Defaults to 1000 if unset. |
| specs/001-.../output/accs.bash | Unchanged entry point from spec 001, still exits 0 for a healthy read-only mock and used as a precondition gate by this spec's ACCS. |

## Open questions

- Poll interval value isn't stated anywhere — recommend keeping the 1000ms default described above rather than blocking on it.
- Should the mutation endpoint validate/reject empty comment bodies? Recommend yes, reject with 400, since the accs.md scenario never sends an empty body and nothing in the spec asks for that leniency.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **What exact HTTP path and method does the comment mutation use?** POST /issues/:number/comments, mirroring the read-side issue-numbering already established by spec 001's endpoints.
- **Does the tracker start commenting immediately or wait for the mock's progressive load to finish?** Tracker polls on its own cadence starting immediately at launch; it will simply pick up newly-appeared issues in later poll cycles as the mock streams them in, per the Init note that discovery of new issues triggers the comment.

## Done when

- specs/002-early-alpha-issues-reader/output/accs.bash exits 0
- with mock GitHub and the tracker both running, curl-ing a new comment onto an issue produces an immediate 'New comment on issue #<n> by <author>' log line followed by a full terminal repaint showing the updated comment count and body

## Behaviour

### Tracker touches every issue exactly once

| input | expected |
| ----- | -------- |
| Mock GitHub starts with issues and zero comments; tracker starts and polls | each issue that exists at poll time gets exactly one "I've been here!" comment from author "GitHub Issues Tracker", never more than one even across further poll cycles |
| An issue already has a "GitHub Issues Tracker" comment | tracker does not comment on it again |

### Manual comment via curl interleaves with tracker comment

| input | expected |
| ----- | -------- |
| curl POST { "author": "curl-user", "body": "Hello World!" } to the first issue, tracker running concurrently | first issue ends up with 2 comments: the curl one and the tracker's "I've been here!"; other already-loaded issues end up with 1 comment (just the tracker's); issues not yet streamed in by t=4s legitimately show 0 |

### Full repaint discipline

| input | expected |
| ----- | -------- |
| Any comment mutation, from curl or from the tracker | terminal clears and reprints the complete current issue list, not just the changed issue |

## Decisions already made

- **Comment payload is { author?, body } with author defaulting to "Anonymous" when omitted** — 2026-09-10 Init doesn't specify a curl payload shape; accs.md curls a comment without stating an author, so the endpoint has to tolerate that.
- **Tracker's own service state (which issues it's touched) is purely in-memory, re-derived from reading each issue's existing comments rather than a private log** — 2026-09-10 Init says 'writes a comment under any issue it hasn't already touched' — the only durable signal available is the comment list itself, and 001/002 both forbid persistence.
- **Tracker poll interval defaults to 1000ms, configurable via ISSUES_TRACKER_POLL_INTERVAL_MS** — Init and accs.md never state a cadence; accs.md's 4-second check window needs at least a couple of poll cycles to be reliable, so a 1s default was picked over anything slower.
- **001's accs.bash stays untouched and is treated as a precondition gate: run it, and only tear down the 001 process if it exits 0, then continue into 002's own checks** — accs.md literally instructs this order and failure behavior.

## Out of scope

- editing or deleting existing comments
- authenticating or rate-limiting the mutation endpoint
- persisting tracker touch-state or mock GitHub state to disk
- real GitHub API integration (that's Beta per the assessment roadmap)

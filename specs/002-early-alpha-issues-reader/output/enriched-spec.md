<!-- enrich:meta
generated: 2026-09-11
source-sha: c68a7f0f3949
status: approved
from: 2026-09-10 — Init
file: specs/002-early-alpha-issues-reader/output/accs.bash
-->

## Read this first

Fake GitHub gains a mutation endpoint for issue comments, and the Issues Tracker proactively drops a marker comment on every issue it hasn't touched yet.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | startup preload - 60% - remaining backfill window - 10s - default poll interval - 1000ms - default mock port - 4001 - accs check timestamp - 4s after mock spawn |
| **Not this** | prod GitHub client - persistence across restarts - comment editing or deletion - rate limiting - authentication on the mock endpoints - multi-repo support |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| env GITHUB_MODE | Only accepted value in this spec is 'mock'. Tracker refuses to start (non-zero exit, stderr message) against anything else — prod GitHub is out of scope until Beta. |
| env MOCK_GITHUB_PORT (default 4001) | Port the mock service binds its HTTP API and terminal to. |
| env ISSUE_TRACKER_POLL_MS (default 1000) | Interval the tracker polls the mock service for issues/comments. |
| pnpm mock-github | Boots the In-Memory Stateful Fake GitHub Service: loads 60% of mock issues immediately, remaining 40% linearly over the next 10s, exposes the HTTP API below, and prints the GitHub Service Terminal to stdout. |
| pnpm issue-tracker:proactive | Boots the Proactive Issues Tracker against MOCK_GITHUB_PORT, polling on ISSUE_TRACKER_POLL_MS. |
| GET http://localhost:<MOCK_GITHUB_PORT>/issues | Returns JSON array of issues currently loaded, each item has at least { number, title, comments_count }. |
| GET http://localhost:<MOCK_GITHUB_PORT>/issues/:number/comments | Returns JSON array of comments on that issue, each item has at least { body }. |
| POST http://localhost:<MOCK_GITHUB_PORT>/issues/:number/comments  body: { "body": string } | Appends a comment to the issue in memory, returns 201 with the created comment. Immediately bumps that issue's comments_count on the next GET /issues. |
| stdout line: 'Issue #<number>: <comments_count> comment(s)' | Printed by the GitHub Service Terminal for every issue, every time the terminal repaints. |
| stdout line: 'New comment on issue #<number>' | Printed by the GitHub Service Terminal exactly once, immediately after any comment (curl or tracker) is accepted. |
| GitHub Service Terminal repaint behaviour | On every repaint it clears the terminal and reprints the full current issue list top to bottom — never a diff or an append. |
| comment body: 'I've been here!' | Exact string the tracker writes, once, on the first poll cycle where it observes an issue it has no record of having commented on yet. |

## Open questions

- Should the tracker's touched-set survive a tracker restart (re-read existing comments to infer past touches) or start clean every run? Recommendation: start clean — this spec has no persistence anywhere else, staying consistent is simpler. (no)

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **Exact HTTP route shapes for the mutation endpoint and issue listing** REST-ish /issues and /issues/:number/comments, since spec.md only says 'a simple mutational endpoint' without naming it
- **What triggers a terminal repaint** Every poll tick and every accepted comment, since spec.md says it must 'always paint the current state fully' without specifying cadence
- **Command names to launch each process** pnpm mock-github and pnpm issue-tracker:proactive, following the existing script-per-service convention implied by the repo's src/ layout

## Done when

- pnpm mock-github serves GET/POST /issues* per the contract
- pnpm issue-tracker:proactive comments 'I've been here!' on every issue it discovers without double-commenting on repeat polls
- GitHub Service Terminal prints comment counts per issue and a log line per new comment, fully repainting each cycle
- specs/002-early-alpha-issues-reader/accs.bash exits 0

## Behaviour

### no double-touch

| input | expected |
| ----- | -------- |
| tracker polls the same untouched issue twice before it has posted | at most one 'I've been here!' comment is ever posted per issue by the tracker, regardless of poll count |
| issue already has a human/curl comment but no tracker comment | tracker still posts 'I've been here!' — 'touched' is tracked by the tracker's own memory of issues it already commented on, not by comment count |

### mock-only enforcement

| input | expected |
| ----- | -------- |
| GITHUB_MODE unset or set to anything other than 'mock' | tracker exits non-zero immediately, no network calls made |

### terminal repaint

| input | expected |
| ----- | -------- |
| a new comment lands via curl | terminal logs 'New comment on issue #<n>' then, on its next scheduled repaint, reprints every issue's line with the updated count — not just the changed one |

## Decisions already made

- **GITHUB_MODE=mock is a hard gate, not a config default** — 2026-09-10 Init: 'ONLY MOCK INSTANCES!' — made explicit and enforced so Beta's prod-GitHub switch can't be accidentally triggered early
- **Tracker's 'already touched' bookkeeping lives in the tracker's own memory, keyed by issue number** — 2026-09-10 Init: accs.md expects issue #1 to end with 2 comments (tracker's + curl's) and other issues with 1, which only works if 'touched' means 'I already commented', not 'issue has any comment'
- **Default poll interval set to 1000ms** — accs.md checks state at the 4s mark against a 10s linear load window — needs several poll cycles to land inside that window without being specified in the prose

## Out of scope

- persisting the tracker's touched-issue set across restarts
- handling GitHub secondary rate limits
- comment threading or replies

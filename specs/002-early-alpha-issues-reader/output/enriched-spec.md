<!-- enrich:meta
generated: 2026-09-12
source-sha: d16cf219e9a1
status: approved
from: 2026-09-11 — Init
from: 2026-09-12 — Mock GitHub Improvements
from: 2026-09-12 — Mock GitHub Testing Improvements
from: 2026-09-12 — GitHub Cli Revamp
file: specs/002-early-alpha-issues-reader/output/accs.bash
-->

## Read this first

Mock GitHub serves issues and comments in memory with a bounded, snapshot-marked terminal view, and the Issues Tracker leaves a one-time 'I've been here!' comment on every untouched issue.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | default port - 4000 - default poll interval - 2000ms - buffer cap (default) - min(tty rows, 200) - fallback buffer (no tty, default) - 200 - buffer cap (override) - MOCK_GITHUB_BUFFER_CAP if set - accs override value - 500 - initial mock load - 60% instant, rest over 10s (spec 001, unchanged) |
| **Not this** | no persistence across restarts - no real GitHub API calls anywhere in this spec - no comment editing/deletion - no auth on mutation endpoint - no pagination on GET /issues - no concurrent multi-tracker dedupe beyond author-name check |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| pnpm mock-github | Starts the In-Memory Stateful Fake GitHub Service: HTTP server plus terminal renderer sharing in-memory state. Loads 60% of mock issues immediately, rest linearly over 10s, per spec 001. |
| env MOCK_GITHUB_PORT (default 4000) | Port the Mock GitHub HTTP server listens on. |
| GET /issues | Returns JSON array of issues, each with id, title, content, comments[] (author, body, createdAt), reflecting exact in-memory state at call time. |
| POST /issues/:id/comments { author, body } | Appends a comment in memory, returns updated issue JSON with status 201, or 404 if id doesn't exist. |
| stdout marker line: "===SNAPSHOT <n> <isoTimestamp>===" | First line of every repaint, n strictly increasing from 0. Everything until the next marker is one complete screen, no issue repeats within it. |
| Mock GitHub terminal issue line format: "Issues #<id>: (<commentCount>)" | commentCount always equals comments.length from GET /issues at render time. |
| Mock GitHub terminal comment-added log line: "[comment] issue #<id> +1 from <author>" | Printed once, immediately on successful POST, before the next scheduled repaint. |
| Mock GitHub terminal truncation line: "..." | If the full listing can't fit the buffer cap, printing stops and the last line is exactly "...", itself counted toward the cap. |
| env MOCK_GITHUB_BUFFER_CAP (optional, positive integer) | When set, replaces the entire min(stdout.rows,200)/200-fallback cap with this fixed number of lines per screen, snapshot marker included. Unset: behaves exactly as before — min(process.stdout.rows, 200), or 200 when stdout is not a TTY. |
| pnpm issues-tracker | Starts the Proactive Issues Tracker. Polls GET /issues; for every issue with no comment authored exactly "GitHub Issues Tracker", POSTs { author: "GitHub Issues Tracker", body: "I've been here!" } exactly once. |
| env MOCK_GITHUB_URL (default http://localhost:4000) | Base URL the Issues Tracker polls. |
| env ISSUES_TRACKER_POLL_INTERVAL_MS (default 2000) | Interval between tracker poll cycles. |

## Open questions

- Should the tracker's poll interval stay configurable via env (2000ms default)? Recommend yes — accs needs deterministic waits.
- Should GET /issues comment ordering be insertion order (oldest first)? Recommend yes — matches the 2026-09-12 example print.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **Exact tracker comment author string to check for prior touch** "GitHub Issues Tracker" — matches the example print in 2026-09-12 Mock GitHub Improvements
- **Default port/poll-interval numbers, not stated in prose** 4000 and 2000ms — arbitrary but stable, both overridable via env
- **What value accs.bash should set MOCK_GITHUB_BUFFER_CAP to when piping mock-github to a log file** 500 — comfortably above any plausible mock dataset size (fixture is well under 200 issues total including comments lines), high enough that the 'fit in the entire list of entries' duplication checks never hit a truncation-induced false negative, while still low enough that a runaway dataset would still get caught by a separate, unbounded-cap-independent duplicate-id check

## Done when

- pnpm mock-github serves GET /issues and accepts POST /issues/:id/comments, mutating in-memory state
- Mock GitHub terminal output contains a "===SNAPSHOT n ...===" line before every repaint, n strictly increasing
- Within any single snapshot, every issue id appears at most once and the total line count never exceeds the active cap (default or MOCK_GITHUB_BUFFER_CAP override)
- pnpm issues-tracker, run once against untouched issues, results in every issue having a "GitHub Issues Tracker" / "I've been here!" comment, without re-touching issues that already have one

## Behaviour

### comment count display

| input | expected |
| ----- | -------- |
| issue with 2 comments in memory | terminal line reads "Issues #<id>: (2)" |

### comment-added logging

| input | expected |
| ----- | -------- |
| POST /issues/5/comments {author:'JohnDoe', body:'hi'} | line "[comment] issue #5 +1 from JohnDoe" prints immediately, before next scheduled repaint |

### full repaint on change

| input | expected |
| ----- | -------- |
| any mutation (new issue loaded, or comment added) | new "===SNAPSHOT n+1 ...===" line followed by complete current state; no issue from previous screen assumed still visible |

### buffer truncation (default cap)

| input | expected |
| ----- | -------- |
| issue listing longer than the active cap, MOCK_GITHUB_BUFFER_CAP unset | printing stops before exceeding min(tty rows,200)/200 and final line is exactly "..." |

### buffer override for full-coverage tests

| input | expected |
| ----- | -------- |
| MOCK_GITHUB_BUFFER_CAP=500 set before spawning pnpm mock-github | cap becomes 500 lines regardless of TTY presence, letting a full mock dataset render without truncation |

### proactive commenting

| input | expected |
| ----- | -------- |
| issue with zero comments | tracker posts one comment: author "GitHub Issues Tracker", body "I've been here!" |
| issue already having a "GitHub Issues Tracker" comment | tracker posts nothing further |
| issue with only non-tracker comments (e.g. JohnDoe) | tracker still posts its one comment, count becomes existing+1 |

## Decisions already made

- **Snapshot boundary is a literal stdout marker line, not ANSI clear codes** — 2026-09-12 Mock GitHub Testing Improvements — needed a way to tell snapshots apart that survives piping/redirection during tests
- **Tracker identifies 'already touched' purely by comment author string match, no separate touched-log** — 2026-09-11 Init — state stays in the mock service, memory-only anyway
- **Comment-added log line prints immediately on mutation, decoupled from repaint loop** — 2026-09-11 Init — logging requirement is distinct from full repaint requirement
- **No-TTY fallback is a hard 200 by default, never less** — 2026-09-12 GitHub Cli Revamp — explicit fallback rule
- **Added MOCK_GITHUB_BUFFER_CAP override, replacing the default cap entirely when set, read identically by the renderer and by any ACCS snapshot parser** — prior verification rejected this spec — accs.bash piped mock-github to a log file (never a TTY), so the 200-line fallback always applied with no way to raise it for a larger dataset, and the ACCS's own BUFFER_CAP check wasn't wired to the same source of truth. One shared env var fixes both.

## Out of scope

- comment editing/deletion endpoints
- multi-tracker coordination locks
- persisting state to disk
- rate limiting or auth on the mutation endpoint

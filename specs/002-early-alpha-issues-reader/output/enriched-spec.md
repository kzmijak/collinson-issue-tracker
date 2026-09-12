<!-- enrich:meta
generated: 2026-09-12
source-sha: 5eb6024bc0cc
status: approved
from: 2026-09-11 — Init
from: 2026-09-12 — Mock GitHub Improvements
from: 2026-09-12 — Mock GitHub Testing Improvements
from: 2026-09-12 — GitHub Cli Revamp
from: 2026-09-12 — GitHub Service Port
file: specs/002-early-alpha-issues-reader/output/accs.bash
-->

## Read this first

Mock GitHub serves issues and comments in memory with a bounded, snapshot-marked terminal view on port 4123, and the Issues Tracker leaves a one-time 'I've been here!' comment on every untouched issue.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | default port - 4123 - default poll interval - 2000ms - buffer cap (default) - min(tty rows, 200) - fallback buffer (no tty, default) - 200 - buffer cap (override) - MOCK_GITHUB_BUFFER_CAP if set - accs override value - 500 - initial mock load - 60% instant, rest over 10s (spec 001, unchanged) |
| **Not this** | no persistence across restarts - no real GitHub API calls anywhere in this spec - no comment editing/deletion - no auth on mutation endpoint - no pagination on GET /issues - no concurrent multi-tracker dedupe beyond author-name check |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| pnpm mock-github | Starts the In-Memory Stateful Fake GitHub Service: HTTP server plus terminal renderer sharing in-memory state. Loads 60% of mock issues immediately, rest linearly over 10s, per spec 001. |
| env MOCK_GITHUB_PORT (default 4123) | Port the Mock GitHub HTTP server listens on. Matches spec 001's frozen default so both specs agree without either script needing to override the other. |
| .env.example | Ships MOCK_GITHUB_PORT=4123 as the committed default, per the 2026-09-12 GitHub Service Port directive. |
| GET /issues | Returns JSON array of issues, each with id, title, content, comments[] (author, body, createdAt), reflecting exact in-memory state at call time. |
| POST /issues/:id/comments { author, body } | Appends a comment in memory, returns updated issue JSON with status 201, or 404 if id doesn't exist. |
| stdout marker line: "===SNAPSHOT <n> <isoTimestamp>===" | First line of every repaint, n strictly increasing from 0. Everything until the next marker is one complete screen, no issue repeats within it. |
| Mock GitHub terminal issue line format: "Issues #<id>: (<commentCount>)" | commentCount always equals comments.length from GET /issues at render time. |
| Mock GitHub terminal comment-added log line: "[comment] issue #<id> +1 from <author>" | Printed once, immediately on successful POST, before the next scheduled repaint. |
| Mock GitHub terminal truncation line: "..." | If the full listing can't fit the buffer cap, printing stops and the last line is exactly "...", itself counted toward the cap. |
| env MOCK_GITHUB_BUFFER_CAP (optional, positive integer) | When set, replaces the entire min(stdout.rows,200)/200-fallback cap with this fixed number of lines per screen, snapshot marker included. Unset: behaves exactly as before. |
| pnpm issues-tracker | Starts the Proactive Issues Tracker. Polls GET /issues; for every issue with no comment authored exactly "GitHub Issues Tracker", POSTs { author: "GitHub Issues Tracker", body: "I've been here!" } exactly once. |
| env MOCK_GITHUB_URL (default http://localhost:4123) | Base URL the Issues Tracker polls, matching the mandated mock port. |
| env ISSUES_TRACKER_POLL_INTERVAL_MS (default 2000) | Interval between tracker poll cycles. |

## Exports

What later specs have to honour. Changing any of these breaks the specs that rely on them.

| name | value | why |
| ---- | ----- | --- |
| mock port default | 4123 | 2026-09-12 GitHub Service Port directive mandates it, and it's the value spec 001's frozen accs.bash already assumes, so no cross-script override is ever needed. |

## Open questions

- Should the tracker's poll interval stay configurable via env (2000ms default)? Recommend yes — accs needs deterministic waits.
- Should GET /issues comment ordering be insertion order (oldest first)? Recommend yes — matches the 2026-09-12 example print.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **Exact tracker comment author string to check for prior touch** "GitHub Issues Tracker" — matches the example print in 2026-09-12 Mock GitHub Improvements
- **Default poll interval, not stated in prose** 2000ms — arbitrary but stable, overridable via env
- **What value accs.bash should set MOCK_GITHUB_BUFFER_CAP to when piping mock-github to a log file** 500 — comfortably above any plausible mock dataset size, high enough truncation checks never false-negative

## Done when

- pnpm mock-github serves GET /issues and accepts POST /issues/:id/comments on port 4123 by default, mutating in-memory state
- Mock GitHub terminal output contains a "===SNAPSHOT n ...===" line before every repaint, n strictly increasing
- Within any single snapshot, every issue id appears at most once and the total line count never exceeds the active cap
- pnpm issues-tracker, run once against untouched issues, results in every issue having a "GitHub Issues Tracker" / "I've been here!" comment, without re-touching issues that already have one
- .env.example contains MOCK_GITHUB_PORT=4123

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
| any mutation | new "===SNAPSHOT n+1 ...===" line followed by complete current state; no issue from previous screen assumed still visible |

### buffer truncation (default cap)

| input | expected |
| ----- | -------- |
| issue listing longer than the active cap, MOCK_GITHUB_BUFFER_CAP unset | printing stops before exceeding min(tty rows,200)/200 and final line is exactly "..." |

### buffer override for full-coverage tests

| input | expected |
| ----- | -------- |
| MOCK_GITHUB_BUFFER_CAP=500 set before spawning pnpm mock-github | cap becomes 500 lines regardless of TTY presence |

### proactive commenting

| input | expected |
| ----- | -------- |
| issue with zero comments | tracker posts one comment: author "GitHub Issues Tracker", body "I've been here!" |
| issue already having a "GitHub Issues Tracker" comment | tracker posts nothing further |
| issue with only non-tracker comments | tracker still posts its one comment, count becomes existing+1 |

### port alignment with spec 001

| input | expected |
| ----- | -------- |
| accs.bash invokes spec 001's frozen accs.bash then this spec's own steps, neither script exporting MOCK_GITHUB_PORT | both scripts probe port 4123 successfully because it's the shared default, no override needed and no ordering conflict possible |

## Decisions already made

- **Default port changed from 4000 to 4123 project-wide for the mock service, and mirrored into .env.example** — 2026-09-12 GitHub Service Port breakpoint
- **accs.bash must not export MOCK_GITHUB_PORT before invoking spec 001's frozen accs.bash — the shared 4123 default makes both scripts agree without any override** — fixes the rejected verdict: prior draft exported 4000 while spec 001's own probe assumed 4123, so they could never agree; aligning the defaults removes the need for any export at that point in the file
- **Snapshot boundary is a literal stdout marker line, not ANSI clear codes** — 2026-09-12 Mock GitHub Testing Improvements
- **Tracker identifies 'already touched' purely by comment author string match, no separate touched-log** — 2026-09-11 Init
- **Comment-added log line prints immediately on mutation, decoupled from repaint loop** — 2026-09-11 Init
- **No-TTY fallback is a hard 200 by default, never less** — 2026-09-12 GitHub Cli Revamp
- **Added MOCK_GITHUB_BUFFER_CAP override, replacing the default cap entirely when set** — prior verification rejected the missing override; one shared env var fixes rendering and ACCS parsing alike

## Out of scope

- comment editing/deletion endpoints
- multi-tracker coordination locks
- persisting state to disk
- rate limiting or auth on the mutation endpoint

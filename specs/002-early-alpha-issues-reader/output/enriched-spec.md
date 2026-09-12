<!-- enrich:meta
generated: 2026-09-12
source-sha: 304755a1ba25
status: approved
from: 2026-09-11 — Init
from: 2026-09-12 — Mock GitHub Improvements
from: 2026-09-12 — Mock GitHub Testing Improvements
from: 2026-09-12 — GitHub Cli Revamp
from: 2026-09-12 — GitHub Service Port
file: specs/002-early-alpha-issues-reader/output/accs.bash
-->

## Read this first

Mock GitHub serves issues/comments in memory with an event-driven snapshot-marked terminal view on port 4123, and the Issues Tracker leaves a one-time 'I've been here!' comment on every untouched issue.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | default port - 4123 - default poll interval - 2000ms - buffer cap (default) - min(tty rows, 200) - fallback buffer (no tty, default) - 200 - buffer cap (override) - MOCK_GITHUB_BUFFER_CAP if set - accs override value - 500 - repaint latency bound (default) - MOCK_GITHUB_REPAINT_LATENCY_MS 500ms - initial mock load - 60% instant, rest over 10s (spec 001, unchanged) |
| **Not this** | no persistence across restarts - no real GitHub API calls anywhere in this spec - no comment editing/deletion - no auth on mutation endpoint - no pagination on GET /issues - no concurrent multi-tracker dedupe beyond author-name check - no repaint on a timer independent of state changes - duplicate-check logic must not write scratch files to disk |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| pnpm mock-github | Starts the In-Memory Stateful Fake GitHub Service: HTTP server plus terminal renderer sharing in-memory state. Loads 60% of mock issues immediately, rest linearly over 10s, per spec 001. |
| env MOCK_GITHUB_PORT (default 4123) | Port the Mock GitHub HTTP server listens on. Matches spec 001's frozen default. |
| .env.example | Ships MOCK_GITHUB_PORT=4123 as the committed default. |
| GET /issues | Returns JSON array of issues, each with id, title, content, comments[] (author, body, createdAt), reflecting exact in-memory state at call time. |
| POST /issues/:id/comments { author, body } | Appends a comment in memory, returns updated issue JSON with status 201, or 404 if id doesn't exist. |
| Repaint model | There is no fixed repaint schedule. A repaint (full clear + redraw) happens ONLY when triggered by a state change: (a) an initial-load tick adding issues over the first 10s, or (b) a successful POST /issues/:id/comments. Nothing else causes a repaint. Every repaint must fully complete - including its snapshot marker line - within MOCK_GITHUB_REPAINT_LATENCY_MS (default 500) of the triggering state change. |
| env MOCK_GITHUB_REPAINT_LATENCY_MS (default 500) | Upper bound, in ms, between a triggering state change and that repaint's marker line appearing on stdout. ACCS waits must exceed this value plus network/process slack to safely observe a post-mutation repaint. |
| stdout marker line: "===SNAPSHOT <n> <isoTimestamp>===" | First line of every repaint. n is a non-negative integer, strictly greater than the n of every prior marker this process has printed (starts at 0). Everything until the next marker is one complete screen, no issue repeats within it. |
| Mock GitHub terminal issue line format: "Issues #<id>: (<commentCount>)" | commentCount always equals comments.length from GET /issues at render time. |
| Mock GitHub terminal comment-added log line: "[comment] issue #<id> +1 from <author>" | Printed synchronously right after the POST that caused it resolves, and no later than the start of the repaint that same POST triggers - it always precedes or opens that repaint's snapshot marker line, never a marker from an unrelated later trigger. |
| Mock GitHub terminal truncation line: "..." | If the full listing can't fit the buffer cap, printing stops and the last line is exactly "...", itself counted toward the cap. |
| env MOCK_GITHUB_BUFFER_CAP (optional, positive integer) | When set, replaces the entire min(stdout.rows,200)/200-fallback cap with this fixed number of lines per screen, snapshot marker included. Unset: behaves exactly as before. |
| pnpm issues-tracker | Starts the Proactive Issues Tracker. Polls GET /issues; for every issue with no comment authored exactly "GitHub Issues Tracker", POSTs { author: "GitHub Issues Tracker", body: "I've been here!" } exactly once. |
| env MOCK_GITHUB_URL (default http://localhost:4123) | Base URL the Issues Tracker polls. |
| env ISSUES_TRACKER_POLL_INTERVAL_MS (default 2000) | Interval between tracker poll cycles. |
| freeing MOCK_GITHUB_PORT for cleanup/re-run | Whatever is bound to MOCK_GITHUB_PORT must be killed by port (fuser -k <port>/tcp or lsof -ti:<port> | kill), never by matching a command-line string like 'pnpm mock-github'. |

## Exports

What later specs have to honour. Changing any of these breaks the specs that rely on them.

| name | value | why |
| ---- | ----- | --- |
| mock port default | 4123 | 2026-09-12 GitHub Service Port directive, matches spec 001's frozen accs.bash. |
| repaint latency bound | MOCK_GITHUB_REPAINT_LATENCY_MS default 500 | Gives the ACCS a concrete, contract-owned number to size its post-mutation wait against, instead of an unjustified hardcoded 2.5s. |

## Open questions

- Should the tracker's poll interval stay configurable via env (2000ms default)? Recommend yes.
- Should GET /issues comment ordering be insertion order (oldest first)? Recommend yes.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **Exact tracker comment author string to check for prior touch** "GitHub Issues Tracker" - matches the example print in 2026-09-12 Mock GitHub Improvements
- **Default poll interval, not stated in prose** 2000ms - arbitrary but stable, overridable via env
- **What value accs.bash should set MOCK_GITHUB_BUFFER_CAP to for full-coverage checks** 500 - comfortably above any plausible mock dataset size
- **How the ACCS should reliably stop the mock service between checks** kill by whatever holds MOCK_GITHUB_PORT, not by matching a 'pnpm mock-github' command string
- **What repaint latency bound the ACCS's post-mutation wait should be justified against, since prose never states one** MOCK_GITHUB_REPAINT_LATENCY_MS, default 500ms - well under accs.bash's existing 2.5s wait, giving it real margin instead of an arbitrary number

## Done when

- pnpm mock-github serves GET /issues and accepts POST /issues/:id/comments on port 4123 by default, mutating in-memory state
- Mock GitHub terminal output contains a "===SNAPSHOT n ...===" line before every repaint, n strictly increasing, and ACCS numerically asserts that monotonicity rather than only matching the marker pattern
- Within any single snapshot, every issue id appears at most once and the total line count never exceeds the active cap
- A repaint triggered by a POST completes within MOCK_GITHUB_REPAINT_LATENCY_MS of that POST resolving
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
| POST /issues/5/comments {author:'JohnDoe', body:'hi'} | line "[comment] issue #5 +1 from JohnDoe" prints immediately, no later than the start of the repaint this same POST triggers |

### repaint is event-driven only

| input | expected |
| ----- | -------- |
| no state change occurs for an extended period | no new snapshot marker is printed - repaint never fires on a timer |
| a mutation lands | exactly one new repaint fires, marker line n+1 printed within MOCK_GITHUB_REPAINT_LATENCY_MS |

### snapshot numbering

| input | expected |
| ----- | -------- |
| sequence of markers across a run | parsed n values are strictly increasing integers starting at 0, checked numerically, not just presence of the marker string |

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
| accs.bash invokes spec 001's frozen accs.bash then this spec's own steps, neither exporting MOCK_GITHUB_PORT | both scripts probe port 4123 successfully |

### reliable cleanup

| input | expected |
| ----- | -------- |
| accs.bash needs to free MOCK_GITHUB_PORT after use | kill targets whatever process is bound to the port, not a 'pnpm mock-github' command-line match |

## Decisions already made

- **Repaint is strictly event-driven - triggered only by initial-load ticks or mutations, never by a wall-clock schedule** — resolves the contradiction the reviewer flagged between 'before next scheduled repaint' wording and the mutation-triggered behaviour row
- **Added MOCK_GITHUB_REPAINT_LATENCY_MS (default 500ms) as the bound accs.bash's post-mutation wait must be sized against** — reviewer noted no interval existed anywhere for accs.bash's hardcoded 2.5s wait to be justified by
- **ACCS must numerically parse and assert snapshot number monotonicity, not just detect the marker pattern** — reviewer's should-fix on check_snapshots() only resetting state on the marker without checking n
- **Default port changed from 4000 to 4123 project-wide, mirrored into .env.example** — 2026-09-12 GitHub Service Port breakpoint
- **accs.bash must not export MOCK_GITHUB_PORT before invoking spec 001's frozen accs.bash** — shared 4123 default makes both scripts agree without override
- **Snapshot boundary is a literal stdout marker line, not ANSI clear codes** — 2026-09-12 Mock GitHub Testing Improvements
- **Duplicate/coverage checks over the snapshot must be a single pass, no intermediate scratch files** — prior harness review flagged a dead csplit stage
- **Cleanup must free MOCK_GITHUB_PORT by port lookup, not by matching 'pnpm mock-github' in a process list** — pnpm's forked child argv likely won't contain that literal string
- **Tracker identifies 'already touched' purely by comment author string match, no separate touched-log** — 2026-09-11 Init
- **No-TTY fallback is a hard 200 by default, never less** — 2026-09-12 GitHub Cli Revamp
- **Added MOCK_GITHUB_BUFFER_CAP override, replacing the default cap entirely when set** — prior verification rejected the missing override

## Out of scope

- comment editing/deletion endpoints
- multi-tracker coordination locks
- persisting state to disk
- rate limiting or auth on the mutation endpoint
- a configurable repaint-on-timer mode

<!-- enrich:meta
generated: 2026-09-11
source-sha: d5f0adb4791b
status: approved
from: 2026-09-08 — Init
from: 2026-09-08 — Specify the requirements
from: 2026-09-08 — Specify the requirements 2.0
from: 2026-09-08 — Specify the requirements 3.0
from: 2026-09-09 — Fake GitHub API
from: 2026-09-09 — Fake GitHub API vs GitHub API switch
from: 2026-09-09 — In-place status bar
from: 2026-09-09 — GitHub API Simulator
from: 2026-09-09 — GitHub API Simulator Clarifications
from: 2026-09-09 — Optimistic Scenario Only
file: specs/001-prototype-issues-reader/output/accs.bash
-->

## Read this first

Console poller shows a mock GitHub repo's active issues live, appending new ones as a fake GitHub API grows its dataset, with a live-updating Polling status bar at the bottom.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | mock initial dataset - 15 issues - mock final dataset - 20 issues - mock fill duration - 10s from first successful boot curl - poll interval - 1000ms - accs growth wait - 10s from first successful boot curl - accs settle wait - 3s - liveliness probe gap - 1.4s x up to 3 attempts - mock API port default - 4123 - curl max-time - 5s per call - accs overall timeout - 60s - closed issues required in seed dataset - at least 1 |
| **Not this** | no real GitHub calls - no runtime dataset mutation - no persistence across restarts - no token validation logic - no assumption about tracker's exact line format beyond containing the issue's number outside the Polling line - no retrying past the 60s overall deadline - no separate GITHUB_OWNER env var - no raw `cp`/byte-copy of the tracker log for any comparison, only `head -n` line-bounded reads |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| bash specs/001-prototype-issues-reader/output/accs.bash | single entry point, exits 0 when the world matches this spec, exits 1 otherwise, wrapped end-to-end in `timeout 60` |
| GET /repos/{owner}/{repo}/issues | mock GitHub API's issues endpoint, mirrors real GitHub REST shape including per-issue `state` of 'open' or 'closed' |
| GITHUB_REPO env var | holds the combined 'owner/repo' string; accs.bash must build the URL as /repos/${GITHUB_REPO}/issues |
| pnpm mock-github | starts the HTTP server, seeded with 15 issues at boot (at least one closed), growing to 20 within 10s measured from the moment the server first answers a request |
| pnpm prototype-issues-reader | console process printing every open issue's number as a whole word outside the Polling line, appending only, never printing a closed issue's number, with a live Polling status line with 1-3 cycling dots, written in-place via carriage-return redraw and never newline-terminated |
| every curl call inside accs.bash | invoked with --max-time 5 |
| background process launch inside accs.bash | mock-github and prototype-issues-reader are each started via `setsid <cmd> ... &`, so their PID is a killable group leader |
| accs.bash log files (mock.accs.log / tracker.accs.log) | each run writes to a fresh, uniquely-named pair of log files, never truncating a shared filename |
| append-only snapshot method inside accs.bash | both the early snapshot and the later recheck extract the tracker log via `head -n "$SNAP_LINES" "$TRACKER_LOG"` — never `cp` or any raw byte-copy of the live file — so an in-flight, non-newline-terminated status-bar fragment can never be captured as if it were a complete line; the two `head -n` outputs, taken at different times against the same $SNAP_LINES, must be byte-identical |



## Done when

- pnpm mock-github starts an HTTP server exposing GET /repos/:owner/:repo/issues seeded with 15 issues (at least 1 closed), growing to 20 within 10s of first successful response
- pnpm prototype-issues-reader prints every open issue's number outside its Polling line, never a closed one, never removes an earlier line, keeps a live in-place Polling bar with changing dot count
- bash specs/001-prototype-issues-reader/output/accs.bash exits 0 within 60s using only `head -n`-bounded reads for the append-only check, and leaves no orphan processes running after pass or fail

## Behaviour

### Tracker append-only

| input | expected |
| ----- | -------- |
| SNAP_LINES=$(wc -l < "$TRACKER_LOG"); head -n "$SNAP_LINES" "$TRACKER_LOG" saved as snapshot, then re-extracted the same way later in the run | both `head -n $SNAP_LINES` extractions are byte-identical, since neither can ever include an unterminated in-flight status-bar fragment |

## Decisions already made

- **Append-only check must snapshot and recheck the tracker log using the identical `head -n "$SNAP_LINES"` extraction both times, and must never `cp` the raw log file** — verification 2026-09-11 — `cp` grabs whatever partial, non-newline-terminated status-bar bytes are mid-write at that instant, which `head -n` (bounded to complete lines) can never reproduce; the two extraction methods were structurally incapable of matching regardless of tracker correctness, since the spec requires an in-place, non-newline status bar

## Out of scope

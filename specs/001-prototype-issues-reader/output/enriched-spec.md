<!-- enrich:meta
generated: 2026-09-11
source-sha: a31f9c7bb16c
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

A console poller shows a mock GitHub repo's active issues live, appending new ones as a fake GitHub API grows its dataset, with a live-updating Polling status bar at the bottom.

|              |     |
| ------------ | --- |
| **Check**    | `bash output/accs.bash` |
| **Numbers**  | mock initial dataset - 15 issues - mock final dataset - 20 issues - mock fill duration - 10s - poll interval - 1000ms - accs post-start wait - 4s - accs growth wait - 3s - accs settle wait - 3s - liveliness probe gap - 1.4s x up to 3 attempts - mock API port default - 4123 - curl max-time - 5s per call - accs overall timeout - 60s - closed issues required in seed dataset - at least 1 |
| **Not this** | no real GitHub calls - no runtime dataset mutation - no persistence across restarts - no token validation logic - no assumption about tracker's exact line format beyond containing the issue's number outside the Polling line - no retrying past the 60s overall deadline |

## Contract

The facades the ACCS may rely on — nothing else about the implementation can be assumed.

| facade | promise |
| ------ | ------- |
| bash specs/001-prototype-issues-reader/output/accs.bash | single entry point, exits 0 when the world matches this spec, exits 1 otherwise, and never blocks past its own internal deadline |
| GET /repos/{owner}/{repo}/issues | mock GitHub API's issues endpoint, mirrors real GitHub REST shape including a per-issue `state` field of 'open' or 'closed' |
| pnpm mock-github | starts the HTTP server, seeded with 15 issues at boot (including at least one closed issue, fixed at code-time), growing to 20 over the next 10s |
| pnpm prototype-issues-reader | console process printing every open issue's number as a whole word outside the Polling line, appending only, never printing a closed issue's number, with a live Polling status line with 1-3 cycling dots |
| every curl call inside accs.bash | invoked with --max-time 5, so a hung or absent mock-github fails that step within 5s instead of hanging |
| accs.bash process itself | wrapped end-to-end in `timeout 60`, so any stuck step (curl, background process boot, sleep-based waits) forces a non-zero exit at 60s instead of hanging forever |

## Open questions

- Should the 60s accs.bash deadline log which step timed out, or just exit 1 silently? Recommend: yes, print which phase (mock boot / tracker boot / curl / growth wait / settle wait) hit the timeout, since accs reports must stay readable per the dictionary's reporting rules.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **what HTTP path the mock exposes for issues** GET /repos/{owner}/{repo}/issues, matching real GitHub's REST shape, so swapping GITHUB_API_URL is truly plug&play
- **what port the mock listens on by default** 4123, overridable via MOCK_GITHUB_PORT, since none was specified in the prose
- **how to identify a genuine issue line in tracker output without naming src internals** require the issue's own number (fetched independently via curl) to appear as a whole word on a line that is not the Polling status line
- **how to verify 'Only display active issues' without runtime mutation of the mock dataset** require the mock's fixed seed data to contain at least one closed issue and assert its number is absent from tracker output throughout the run
- **how to stop accs.bash from hanging forever on a dead dependency** 5s --max-time per curl plus a 60s `timeout` wrapper around the whole script body

## Done when

- pnpm mock-github starts an HTTP server exposing GET /repos/:owner/:repo/issues seeded with 15 issues (at least 1 closed), growing to 20 over 10s
- pnpm prototype-issues-reader prints every open issue's number the mock reports (outside its Polling line), never a closed one, never removes an earlier line, keeps a live 'Polling' bar with changing dot count
- bash specs/001-prototype-issues-reader/output/accs.bash exits 0 within 60s

## Behaviour

### Mock GitHub API growth

| input | expected |
| ----- | -------- |
| GET /repos/{repo}/issues right after mock-github starts | returns 15 issues within 5s, curl aborts and fails the check past that |
| GET /repos/{repo}/issues 10+ seconds after startup | returns 20 issues, more than the first call |

### Tracker initial display

| input | expected |
| ----- | -------- |
| tracker started against a running mock with N issues (M of them closed) | every open issue number appears as a whole-word token on a non-Polling line within one poll interval; none of the M closed issue numbers ever appear |

### Tracker append-only

| input | expected |
| ----- | -------- |
| the first L lines printed by the tracker, re-read after further polling | those L lines are byte-identical - nothing earlier is cleared, redrawn, or reordered |

### Tracker proactive pickup

| input | expected |
| ----- | -------- |
| mock dataset grows while tracker runs, no manual trigger | every newly-opened issue number appears as a whole-word token on a non-Polling line, unprompted; any newly-grown closed issue never appears |

### Active-only filter

| input | expected |
| ----- | -------- |
| the closed issue(s) present in the mock's static seed dataset | their numbers never appear anywhere in tracker output, checked at both the initial-display phase and the settle phase |

### Status bar

| input | expected |
| ----- | -------- |
| tracker running normally, sampled twice ~1.4s apart | a 'Polling' line with 1-3 trailing dots is present both times and the dot count differs between samples |
| tracker at end of run | 'Polling' line still present |

### Hang protection

| input | expected |
| ----- | -------- |
| mock-github or tracker never comes up, or any curl hangs | accs.bash exits 1 (non-zero) within 60s total, never hangs indefinitely |

## Decisions already made

- **Detect issue lines by matching each issue's number (from live curl responses) as a whole word, searched only across non-Polling lines of tracker output** — reviewer 2026-09-11 rejection round 1: whole-word match alone let incidental digits on the Polling line satisfy the count; excluding the Polling line removes that collision
- **Enforce append-only by diffing the tracker log's first-L-lines snapshot against itself later in the run, byte for byte** — reviewer 2026-09-11 round 1: a count-only check let clear-and-redraw trackers pass; spec's 2026-09-08 'DO NOT remove previous lines' needed a real check
- **Detect a live status bar via two samples ~1.4s apart requiring both to match Polling with 1-3 dots and differ from each other, retried up to 3 times, folded into one check phase** — reviewer 2026-09-11 round 1: merged a redundant early presence probe into the later live-bar check
- **Parse curl responses with node (JSON.parse over stdin) instead of grep/jq** — avoids a jq dependency and brittle regex over JSON, while staying within the 'no src internals' dictionary rule
- **Every curl invocation in accs.bash carries --max-time 5, and the entire script body is wrapped in `timeout 60 ...`** — reviewer 2026-09-11 round 2 'must fix': no timeout meant a hung mock-github or tracker start blocked the script forever, which the dictionary explicitly forbids for ACCS
- **The mock's static seed dataset (code-time only, per 2026-09-09 'no runtime mutation') must include at least one closed issue; accs.bash reads the curl'd dataset, finds any issue with state=='closed', and asserts its number never shows up in tracker output at both the initial-display and settle-wait phases** — reviewer 2026-09-11 round 2 'should fix': 'Only display active issues' (2026-09-08 2.0) was unverified; this closes that gap without any runtime mutation, respecting the static-dataset rule

## Out of scope

- real GitHub token validation or auth failure handling
- persisting tracker or mock state across restarts
- concurrent multiple mock datasets or repos
- configurable loading-indicator content beyond the literal Polling/dots text
- verifying the exact visual format of a line beyond containing the issue's number as a whole word outside the Polling line
- retry/backoff behavior inside accs.bash itself past the 60s deadline

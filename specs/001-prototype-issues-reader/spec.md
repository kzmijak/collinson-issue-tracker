# NNN — Prototype Issues Reader

Status: draft
Covers: 0

## What I want

### 2026-09-08 — Init

Prototype issues reader. Triggered by entering "pnpm prototype-issues-reader" into the console.
Polls the repo's issues via GitHub API. May require GitHub Access Token.
First it displays all the issues, in the next iterations it displays only the new ones.
Polls every 5 seconds.
Each new entry in a new line.
Includes a simplistic loading indicator at the bottom - . -> .. -> ... -> . (easily replaceable with content)

### 2026-09-08 — Specify the requirements

- The process is stateless, it starts from the blank state each time. To discriminate the new entries from the already displayed ones, store the last issue's ID and update it each time you introduce a new message.
- The GITHUB_TOKEN comes from the .env file
- Show all the issues there are in the repo. Issues only, no other parts of the repo.
- DO NOT remove previous lines, append the next ones.
- Use Exponential Backoff strategy to handle exceptions. Double the interval after each consecutive error, reset the counter on success.

### 2026-09-08 — Specify the requirements 2.0

- Repo is an env var; ex. kzmijak/collinson-issue-tracker
- Only display active issues.
- Formatting has to be simplistic and the lines are to be brief. No specific format predefined for this use case.
- Starting interval is same as the usual polling interval, also taken from the envs.
- Specific envs are not predefined, first proposition will establish the convention.
- This process' state is stored memory-only at this stage.
- The process is to run indefinitely, until it is stopped manually.

### 2026-09-08 — Specify the requirements 3.0

- Loading indicator always appears at the bottom, separated by whitespace line from the rest of the output.
  Goes Loading . -> Loading .. -> Loading ...

### 2026-09-09 — Fake GitHub API

- DO NOT connect to the real GitHub yet. Create a mock GitHub API that reflects the real GitHub API shapes, and fill it with mock content.

### 2026-09-09 — Fake GitHub API vs GitHub API switch

- Dataset has to be static with no option to interactively modify it's state. Only modify the data code-time, not runtime.
- Switching from real to fake GitHub and back is made possible via .env var.

### 2026-09-09 — In-place status bar

- At the bottom of the active process terminal there should be an updated in-place status bar.
- It shows Polling (CHANGED FROM Loading) with dots altering between . and .. and ...
- The alteration is in place, not new lines.
- If there was an error, write that in the same line as the Polling, and only remove it the next result is successful. 

### 2026-09-09 — GitHub API Simulator

- Extend the mock dataset to 20 entries 

- Create a GitHub API Simulator service that starts with the dataset of 15 and then gets continuously expanded with another 5 as times goes on (1 every few seconds). 

- Make sure that the API contract mirrors the on of the actual GitHub for plug&play swapping. 

- The point is that Prototype Issues Reader cannot tell if it's real GitHub or the fake on, so it can be designed around it.

- When testing, first spawn the simulator and then the poller, don't remember to close both the poller and the simulator when you're done testing.

- You may use any lightweight node service engine, like express.

### 2026-09-09 — GitHub API Simulator Clarifications

- When no .env is set, the Prototype Issues Reader defaults to mock GitHub provider.

- Prototype Issues Reader no longer has any awareness about the mocks plane. It is only interested in the API URL - and whether this one leads to the mock GitHub or real GitHub, it has no way and no interest in confirming. 

- Only one mocking mechanism can exists at a time, so currently it is to be the GitHub API Simulator.

<!-- Every later change is a new dated heading appended below this one. Never edit an entry that
     is already here: it is the record of what was decided and when. Two entries may share a
     date — order comes from position in the file, not from the date. Give each a distinct
     label; two identical headings are an error. -->

<!-- enrich:generated — everything below is written by `pnpm enrich`; do not edit by hand -->

<!-- enrich:meta
generated: 2026-09-09
source-sha: f89dfe782f8c
status: rejected
from: 2026-09-08 — Init
from: 2026-09-08 — Specify the requirements
from: 2026-09-08 — Specify the requirements 2.0
from: 2026-09-08 — Specify the requirements 3.0
from: 2026-09-09 — Fake GitHub API
from: 2026-09-09 — Fake GitHub API vs GitHub API switch
from: 2026-09-09 — In-place status bar
from: 2026-09-09 — GitHub API Simulator
from: 2026-09-09 — GitHub API Simulator Clarifications
file: specs/001-prototype-issues-reader/test.bash
-->

## Read this first

A long-running console poller prints active GitHub issues for a repo, appending new ones every interval, with an in-place backing-off status bar, backed by a swappable mock or real GitHub API reached through one URL env var.

|              |     |
| ------------ | --- |
| **Check**    | bash specs/001-prototype-issues-reader/test.bash |
| **Proves**   | Starting the simulator (default port, GITHUB_API_URL unset) then the reader shows exactly 13 active issues before the first growth tick, later growing to 18 as 5 arrive one every 3s, never removing a printed line, preserving order; the status bar is exactly one in-place 'Polling' line preceded by one blank line, its trailing bytes changing across two samples 3s apart; a dead-endpoint run keeps the reader alive for 5s showing 'Polling' plus an error indication and zero issue lines; a third run against an endpoint unreachable for 17s then online shows 3 consecutive error-gap growths (each >=1.4x prior) then a post-success gap <=1.5x the base poll interval. |
| **Numbers**  | initial seed - 15 issues - initial active - 13 - final seed - 20 issues - final active - 18 - simulator growth interval - 3s - simulator default port - 4000 - reader default poll interval - 5000ms - test poll interval - 1000ms - backoff - doubles on error, resets on success - status dot cycle - . .. ... repeating - error-run dead endpoint - http://127.0.0.1:9999 - error-run observation window - 5s - backoff-run port - 4001 - backoff-run simulator delay - 17s - backoff sample interval - 250ms - backoff sample count - 90 - backoff growth threshold - 1.4x - backoff reset threshold - 1.5x base - backoff minimum error gaps required - 3 - initial-count check deadline - 2.5s (before first 3s growth tick) |
| **Not this** | no interactive dataset mutation - no persistence to disk - no non-issue repo data - no real network calls in the test - no auth-flow testing beyond token being read from env - no exact backoff ratio assertion beyond the stated thresholds |

## Open questions

- Should GITHUB_API_URL also gate the token header format for a real GitHub call, or is that pure implementation detail deferred to a later spec? Recommend: defer, this spec only proves the mock path.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **How long should the test wait for the 5 additional issues at 'a few seconds'?** 3s interval; test budgets 20s total wait for the 18th line
- **What counts as repo root relative to the test script for invoking pnpm scripts?** two directories up from the test script
- **How does the test tell processes apart in cleanup?** capture each PID at spawn and kill all in a trap on EXIT, guarding against unset vars
- **How to make 'updated in place' falsifiable?** capture raw stdout, count \n-delimited '^Polling' lines: exactly 1
- **How to make blank-line separation falsifiable?** assert the line immediately preceding '^Polling' is empty
- **How to exercise the error path safely?** point GITHUB_API_URL at http://127.0.0.1:9999, observe 5s, assert Polling+error+zero issues, assert kill -0 succeeds at 5s
- **How to check the initial-13 count without racing the first growth tick?** check the count exactly once at 2.5s after reader start (before the 3s growth tick), not via a multi-second polling loop, so a correct implementation cannot be caught mid-growth
- **How to make backoff doubling and reset falsifiable given the 4s original delay produced too few error samples?** raise the backoff-run simulator delay to 17s so three consecutive doubling waits (1s,2s,4s cumulative ~7s) complete and error before the endpoint comes up, giving 4 error samples and 3 gaps to check growth on, each required >=1.4x prior for tolerance; the reset check compares only the first post-success gap to <=1.5x base, unaffected by the larger delay
- **Should small deltas be filtered as noise?** no longer filtering any delta by size; every status-line change is treated as an event so a jittery near-zero implementation cannot hide behind a filter
- **Reader line format?** '#<number> <title>', one per line — operator's prose explicitly declines to define this ('no format predefined, first proposition establishes convention'), so this is an assumption, not a settled decision
- **Does 'active' mean issue.state === 'open'?** yes, taking issue.state === 'open' since GitHub's real shape uses open/closed and the fixture needs a concrete field

## Done when

- pnpm github-api-simulator starts an HTTP server on $PORT (default 4000) serving GET /repos/:owner/:repo/issues in GitHub's issue array shape, seeded with 15 issues growing to 20, one every 3s
- pnpm prototype-issues-reader exits only on manual signal, prints active issues then polls, and running bash specs/001-prototype-issues-reader/test.bash exits 0

## Behaviour

### initial display

| input | expected |
| ----- | -------- |
| reader started against simulator freshly seeded with 15 issues, checked at 2.5s (before 3s growth tick), GITHUB_API_URL unset | stdout contains exactly 13 issue lines |

### append-only growth

| input | expected |
| ----- | -------- |
| simulator grows 15->20 over ~15s | 18 issue lines total, original 13 unchanged and in original order |

### status bar in-place

| input | expected |
| ----- | -------- |
| reader running normally, raw output captured | exactly one \n-delimited 'Polling' line regardless of poll count, preceded by a blank line, trailing bytes differ across two 3s-apart samples |

### error surfacing without dying

| input | expected |
| ----- | -------- |
| GITHUB_API_URL points at nothing listening | within 5s: 'Polling' plus error indication, zero issue lines, reader process alive (kill -0 succeeds) at the 5s mark |

### backoff doubles then resets

| input | expected |
| ----- | -------- |
| GITHUB_API_URL points at a port nothing listens on for 17s, then a simulator starts on that port | 3 consecutive error-state gaps each >=1.4x the prior, then the gap immediately after the first non-error sample is <=1.5x the base 1000ms poll interval |

### provider switch is a single URL

| input | expected |
| ----- | -------- |
| GITHUB_API_URL unset, simulator on default port 4000 | reader connects with no other config, produces the 13-then-18 sequence |

## Acceptance check

```
bash specs/001-prototype-issues-reader/test.bash
```

exit code 0; all background processes (main simulator, main reader, error-run reader, backoff-run reader, backoff-run simulator) are terminated by the script whether it passes or fails

## Decisions already made

- **Env vars: GITHUB_TOKEN, GITHUB_REPO, GITHUB_API_URL, POLL_INTERVAL_MS; simulator uses PORT** — 2026-09-08 3.0 and 2026-09-09 Clarifications leave naming to 'first proposition'
- **GITHUB_API_URL defaults to http://localhost:4000 when unset** — 2026-09-09 Clarifications: 'no .env set -> defaults to mock GitHub provider'
- **Status bar text is 'Polling' + N dots, one line, blank line above, error text appended until next success, updates via carriage-return rewrite** — 2026-09-09 In-place status bar entry
- **Simulator started via pnpm github-api-simulator, serves GET /repos/:owner/:repo/issues** — 2026-09-09 GitHub API Simulator entry: contract mirrors actual GitHub
- **Simulator fixed dataset: issues #1-20, #5 and #10 permanently closed, all others open; seeded #1-15 at start, appends #16-20 one every 3s** — 2026-09-09 Simulator entry requires 15-then-20 static dataset

## Out of scope

- persisting last-seen issue ID across restarts
- real GitHub API integration test
- concurrent multi-repo polling
- a UI beyond plain stdout
- asserting a precise backoff multiplier (exactly 2.0x) rather than growth-then-reset

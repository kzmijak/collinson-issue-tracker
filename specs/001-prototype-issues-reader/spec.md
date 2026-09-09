# NNN — Prototype Issues Reader

Status: draft
Covers: work-order step N in PLAN.md

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


<!-- Every later change is a new dated heading appended below this one. Never edit an entry that
     is already here: it is the record of what was decided and when. Two entries may share a
     date — order comes from position in the file, not from the date. Give each a distinct
     label; two identical headings are an error. -->

<!-- enrich:generated — everything below is written by `pnpm enrich`; do not edit by hand -->

<!-- enrich:meta
generated: 2026-09-09
source-sha: 35d4bd43760c
status: accepted
from: 2026-09-08 — Init
from: 2026-09-08 — Specify the requirements
from: 2026-09-08 — Specify the requirements 2.0
from: 2026-09-08 — Specify the requirements 3.0
from: 2026-09-09 — Fake GitHub API
from: 2026-09-09 — Fake GitHub API vs GitHub API switch
from: 2026-09-09 — In-place status bar
file: specs/001-prototype-issues-reader/test.bash
-->

## Read this first

a long-running console process, started by pnpm prototype-issues-reader, polls a mocked GitHub issues API on a timer, appends each newly-seen open issue as its own stdout line, and maintains an in-place 'Polling' status bar at the bottom that shows errors inline until the next successful poll

|              |     |
| ------------ | --- |
| **Check**    | bash specs/001-prototype-issues-reader/test.bash |
| **Proves**   | the command starts, prints every open issue from the static mock dataset exactly once, never prints the closed issue, separates the issue log from the status bar with one blank line, redraws the status bar in place (via carriage return, never a fresh newline) cycling through the three dot-phases, shows an inline error marker during simulated failures that clears on the next success, and recovers from two consecutive mock failures only after a measurably backed-off delay — all within one run of the script |
| **Numbers**  | poll interval under test-1s - indicator tick-1s - mock dataset size-3 issues - mock open issues-2 - mock closed issues-1 - observation window part1-8s - mock simulated failures-2 - min elapsed before recovery-2.5s - observation window part2-10s |
| **Not this** | real GitHub network calls - persisted/disk state across restarts - issue pagination - rate-limit-specific handling beyond the generic exponential backoff - interactive mutation of mock data at runtime - asserting the exact wording of the inline error message beyond the literal substring 'Error' |

## Open questions

- Should GITHUB_API_MODE default to 'mock' when unset, since the real client isn't built yet? Recommend yes — avoids silently trying to hit GitHub with no working live path.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **Which PLAN.md work-order step does this spec cover?** PLAN.md was not made available to this enrichment pass, so no step number is asserted here rather than inventing one; the operator should fill in the 'Covers' line directly against their own PLAN.md
- **Exact wording/placement of the inline error marker in the status line?** only the literal substring 'Error' is asserted, appearing before the first recovered issue line — the surrounding text (dots, punctuation) is left to the implementer since the operator specified placement ('same line') but not wording
- **How is the blank-line separator represented now that the status bar no longer emits fresh lines?** one real \n-delimited blank line immediately precedes the first \n-terminated line that contains 'Polling' (i.e. the point where the process switches from line-based issue output to in-place status redraw); subsequent redraws reuse that same line via \r and add no further blank lines

## Done when

- bash specs/001-prototype-issues-reader/test.bash exits 0 and prints PASS

## Behaviour

### initial display shows only active issues

| input | expected |
| ----- | -------- |
| GITHUB_API_MODE=mock, mock dataset has 2 open issues and 1 closed issue, first poll fires | stdout contains a line for each open issue; the closed issue's title never appears |

### append-only across repeated polls

| input | expected |
| ----- | -------- |
| process left running across several poll cycles against the static mock dataset | each open issue's line appears exactly once in total output, never duplicated or reprinted |

### status bar redraws in place, never as new lines

| input | expected |
| ----- | -------- |
| process observed for several seconds | raw stdout contains at least one carriage return (\r) and the literal substrings 'Polling .', 'Polling ..', 'Polling ...' each appear somewhere in the byte stream; the literal word 'Loading' never appears |

### status bar separated from issue log by a blank line

| input | expected |
| ----- | -------- |
| stdout split into lines on \n; process observed until the first line containing 'Polling' appears | the \n-delimited line immediately preceding the first line containing 'Polling' is empty |

### inline error marker during failures, cleared on next success

| input | expected |
| ----- | -------- |
| GITHUB_MOCK_FAIL_COUNT=2, POLL_INTERVAL_SECONDS=1 | the literal substring 'Error' appears in stdout at a byte offset earlier than the first open issue line's byte offset |

### exponential backoff recovers from consecutive mock errors

| input | expected |
| ----- | -------- |
| GITHUB_MOCK_FAIL_COUNT=2 (mock API simulates 2 consecutive failures before succeeding), POLL_INTERVAL_SECONDS=1 | the process does not crash or exit; the first open issue line appears only after at least 2.5s of wall-clock time have elapsed since start |

## Acceptance check

```
bash specs/001-prototype-issues-reader/test.bash
```

exits 0 and prints PASS after confirming both open mock issues appear exactly once, the closed one never appears, a blank line separates the log from the status bar, the status bar redraws in place with all three dot-phases present and no literal 'Loading' text, an inline 'Error' marker precedes recovery during simulated failures, and recovery after two simulated mock-API failures is measurably delayed by backoff

## Decisions already made

- **Env vars: GITHUB_TOKEN, GITHUB_REPO, POLL_INTERVAL_SECONDS, GITHUB_API_MODE ('mock'|'live')** — 2026-09-08 Specify the requirements 2.0 leaves envs unnamed and delegates the convention to the first proposal; 2026-09-09 Fake GitHub API vs switch requires an env-driven mock/live switch
- **Issue line format: '#<number> <title>'** — 2026-09-08 Specify the requirements 2.0: 'no specific format predefined', first proposal establishes it
- **Status bar prefix renamed 'Loading' -> 'Polling', ticks once per second cycling . -> .. -> ..., redrawn strictly in place via carriage return, never as a new stdout line** — 2026-09-09 In-place status bar explicitly overrides 2026-09-08 Specify the requirements 3.0's naming and line-per-tick reading: 'CHANGED FROM Loading' and 'The alteration is in place, not new lines'
- **On a failed poll, the status bar's same line carries an inline error indicator (contains the literal word 'Error'); it is removed the moment the next poll succeeds** — 2026-09-09 In-place status bar: 'write that in the same line as the Polling, and only remove it the next result is successful'
- **Mock dataset is 3 fixed issues: 2 open ('#1 Fix login bug', '#3 Add dark mode'), 1 closed ('#2 Update README'), hardcoded in source, not runtime-editable** — 2026-09-09 Fake GitHub API and Fake GitHub API vs switch: static dataset, code-time only
- **Exponential backoff doubles the retry interval from POLL_INTERVAL_SECONDS on each consecutive polling error and resets on success** — 2026-09-08 Specify the requirements: 'Double the interval after each consecutive error, reset the counter on success' — a checked requirement, not merely declared
- **A test-only env var GITHUB_MOCK_FAIL_COUNT controls how many consecutive simulated failures the mock API returns before succeeding, defaulting to 0 when unset** — no operator entry names this; needed to make backoff externally observable without touching real GitHub or the static dataset, per the operator's own rule that unnamed test mechanics are the enricher's to set
- **Blank-line separation applies once, before the status bar's first rendered frame — not repeated per tick, since the bar is now a single in-place line** — 2026-09-08 Specify the requirements 3.0's separation rule still holds; 2026-09-09 In-place status bar changes only the redraw mechanism, not the separation

## Out of scope

- a runtime flag or command to change GITHUB_MOCK_FAIL_COUNT after the process has started
- asserting the exact backoff multiplier sequence beyond a single minimum-elapsed-time check (a fixed 2.5s+ delay with no real doubling would also pass this check — a known, declared gap)
- asserting the exact wording of the inline error text beyond the literal substring 'Error'
- any status-bar content other than the three dot-phases and the optional inline error marker

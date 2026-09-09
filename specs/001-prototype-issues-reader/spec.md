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

<!-- Every later change is a new dated heading appended below this one. Never edit an entry that
     is already here: it is the record of what was decided and when. Two entries may share a
     date — order comes from position in the file, not from the date. Give each a distinct
     label; two identical headings are an error. -->

<!-- enrich:generated — everything below is written by `pnpm enrich`; do not edit by hand -->

<!-- enrich:meta
generated: 2026-09-09
source-sha: d611d2d0accc
status: accepted
from: 2026-09-08 — Init
from: 2026-09-08 — Specify the requirements
from: 2026-09-08 — Specify the requirements 2.0
from: 2026-09-08 — Specify the requirements 3.0
from: 2026-09-09 — Fake GitHub API
from: 2026-09-09 — Fake GitHub API vs GitHub API switch
file: specs/001-prototype-issues-reader/test.bash
-->

## Read this first

A long-running console process, started by pnpm prototype-issues-reader, polls a mocked GitHub issues API on a timer and appends each newly-seen open issue as its own stdout line above a loading indicator that reprints as a fresh line on every tick.

|              |                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Check**    | bash specs/001-prototype-issues-reader/test.bash                                                                                                                                                                                                                                                                                                                                                                   |
| **Proves**   | the command starts, prints every open issue from the static mock dataset exactly once, never prints the closed issue, separates the issue log from the indicator with a blank line, emits all three dot-phases as distinct complete lines, and — when the mock API is made to fail twice in a row — still recovers and shows the issues only after a measurably backed-off delay, all within one run of the script |
| **Numbers**  | poll interval under test-1s - loading tick-1s - mock dataset size-3 issues - mock open issues-2 - mock closed issues-1 - observation window part1-4s - mock simulated failures-2 - min elapsed before recovery-2.5s - observation window part2-10s                                                                                                                                                                 |
| **Not this** | real GitHub network calls - persisted/disk state across restarts - issue pagination - rate-limit-specific handling beyond the generic exponential backoff - interactive mutation of mock data at runtime - in-place terminal redraw of the indicator                                                                                                                                                               |

## Open questions

- Should GITHUB_API_MODE default to 'mock' when unset, since the real client isn't built yet? Recommend yes — avoids silently trying to hit GitHub with no working live path.

## Assumptions taken

Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them
and append an entry if any is wrong.

- **What are the exact env var names for repo, poll interval, and the mock/live switch?** GITHUB_REPO, POLL_INTERVAL_SECONDS, GITHUB_API_MODE — no prior entry fixed these, so this spec's proposal establishes the convention per the operator's own rule
- **What line format should an issue render as?** '#<number> <title>' — shortest form that is unambiguous and 'brief' as required, formalizing the undefined format
- **How fast does the loading indicator itself tick, independent of poll interval?** once per second — not tied to poll interval since the two are described separately in the prose
- **What should the mock dataset actually contain?** 3 issues, 2 open + 1 closed, fixed titles/numbers as listed in decisions — enough to prove active-only filtering without being arbitrary
- **Does 'self-updating loading indicator' mean in-place redraw or a fresh line per tick?** fresh line per tick — the operator's own append-only rule ('DO NOT remove previous lines, append the next ones') governs the whole process's stdout, and only this reading is falsifiable by grepping for three distinct exact lines
- **How should exponential backoff be made observable from outside the process without a real network?** test-only env var GITHUB_MOCK_FAIL_COUNT forcing N consecutive mock-API failures; recovery timing is then checked against a minimum elapsed-time bound

## Done when

- bash specs/001-prototype-issues-reader/test.bash exits 0 and prints PASS

## Behaviour

### initial display shows only active issues

| input                                                                                     | expected                                                                           |
| ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GITHUB_API_MODE=mock, mock dataset has 2 open issues and 1 closed issue, first poll fires | stdout contains a line for each open issue; the closed issue's title never appears |

### append-only across repeated polls

| input                                                                           | expected                                                                                   |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| process left running across several poll cycles against the static mock dataset | each open issue's line appears exactly once in total output, never duplicated or reprinted |

### loading indicator reprints as a new line each tick

| input                                | expected                                                                                                                                                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| process observed for several seconds | stdout contains, as three separate newline-terminated lines at distinct points in the stream, the exact line 'Loading .', the exact line 'Loading ..', and the exact line 'Loading ...' — each tick is a new complete line, never an in-place overwrite of a previous one |

### indicator separated from issue log by a blank line

| input                                                     | expected                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------ |
| process observed until the first 'Loading .' line appears | the line immediately preceding the first 'Loading .' line is empty |

### exponential backoff recovers from consecutive mock errors

| input                                                                                                           | expected                                                                                                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GITHUB_MOCK_FAIL_COUNT=2 (mock API simulates 2 consecutive failures before succeeding), POLL_INTERVAL_SECONDS=1 | the process does not crash or exit; the first open issue line appears only after at least 2.5s of wall-clock time have elapsed since start, evidencing the interval was doubled after each of the two failures rather than the issue appearing at the un-backed-off ~1s poll interval |

## Acceptance check

```
bash specs/001-prototype-issues-reader/test.bash
```

exits 0 and prints PASS after confirming both open mock issues appear exactly once, the closed one never appears, a blank line separates the log from the indicator, all three loading-indicator phases were observed as distinct lines, and recovery after two simulated mock-API failures is measurably delayed by backoff

## Decisions already made

- **Env vars: GITHUB_TOKEN, GITHUB_REPO, POLL_INTERVAL_SECONDS, GITHUB_API_MODE (values 'mock'|'live')** — 2026-09-08 Specify the requirements 2.0 says repo and other envs are unnamed and the first proposal sets convention; 2026-09-09 Fake GitHub API vs switch entry requires an env-driven mock/real switch
- **Issue line format: '#<number> <title>'** — 2026-09-08 Specify the requirements 2.0: 'no specific format predefined for this use case', first proposal establishes it
- **Loading indicator ticks once per second, cycling . -> .. -> ... -> . indefinitely, prefixed 'Loading ', each tick printed as a new, complete stdout line rather than redrawn in place** — 2026-09-08 Init describes the . -> .. -> ... -> . cycle as 'easily replaceable with content'; 2026-09-08 requirements 3.0 adds the 'Loading' prefix and blank-line separation — a line-based, appended stream (matching the append-only issue log's own mechanics) is the only reading consistent with 'DO NOT remove previous lines, append the next ones' applying to the whole process's output
- **Mock dataset is 3 fixed issues: 2 open ('#1 Fix login bug', '#3 Add dark mode'), 1 closed ('#2 Update README'), hardcoded in source, not runtime-editable** — 2026-09-09 Fake GitHub API and Fake GitHub API vs switch entries: static dataset, code-time only
- **Exponential backoff is a checked requirement: on consecutive polling errors the retry interval doubles from POLL_INTERVAL_SECONDS and resets on success** — 2026-09-08 Specify the requirements: 'Use Exponential Backoff strategy... Double the interval after each consecutive error, reset the counter on success' — carried as a decided requirement, so the check must exercise it, not just declare it out of scope for 'beyond' backoff
- **A test-only env var GITHUB_MOCK_FAIL_COUNT controls how many consecutive simulated failures the mock API returns before succeeding, defaulting to 0 (no simulated failures) when unset** — no operator entry names this; needed to make the 2026-09-08 backoff requirement externally observable without touching real GitHub or the static dataset's content, consistent with the operator's own rule that unnamed test mechanics are the enricher's to set

## Out of scope

- a runtime flag or command to change GITHUB_MOCK_FAIL_COUNT after the process has started
- asserting the exact backoff multiplier sequence beyond a single minimum-elapsed-time check
- any indicator content other than the three dot-phases

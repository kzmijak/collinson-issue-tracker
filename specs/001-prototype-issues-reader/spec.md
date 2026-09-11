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

### 2026-09-09 — Optimistic Scenario Only

- Our GitHub mock never fails at this point.
- GitHub mock data injection should be significantly faster, it should take 10 seconds to fill it from 15 to 20 entries.
- Issues Tracker polls every second.


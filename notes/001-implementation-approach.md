# 001 — prototype issues reader: how it was built

Implements `specs/001-prototype-issues-reader/spec.md`. The acceptance check
(`specs/001-prototype-issues-reader/test.bash`) is the definition of done; nothing in it was edited.

## Shape of the code

Two seams, four moving parts.

- `src/github/GitHub.ts` — the port: `GitHub.listIssues()` plus `GitHubIssue`, a subset of the real
  REST issue payload. `src/github/FakeGitHub.ts` — the three fixed issues and the
  `GITHUB_MOCK_FAIL_COUNT` failure simulation. No `RealGitHub.ts`: there is no live path in this
  spec, and an empty class pretending otherwise is worse than its absence.
- `src/reader/config.ts` — env → `ReaderConfig`, throwing `ConfigError` naming the offending
  variable. Nothing polls until this returns.
- `src/reader/issueLines.ts` — open-issue selection against the last printed id, and the `#<number>
  <title>` line.
- `src/reader/statusBar.ts` — the in-place bar. Owns the dot phase, the inline error slot and the
  erase-then-redraw sequence, behind a one-method `StatusBarWriter` port (`stdoutWriter` in
  production, `FakeStatusBarWriter` in tests). Everything the process emits goes through it,
  including issue lines, which is what keeps the bar the last thing on screen: `log()` erases the
  frame, writes the line with its newline, then draws the frame again underneath.
- `src/reader/startReader.ts` — the two clocks. One `setInterval` for the bar's tick, one
  self-rescheduling `setTimeout` for the poll so the backoff delay is chosen after each attempt
  rather than fixed when the timer was created. Exports `backoffDelayMs` because a schedule is where
  a silent bug hides.
- `src/reader/main.ts` — the entrypoint behind `pnpm prototype-issues-reader`. Injects the real
  writer and keeps `consoleLogger` for configuration failures only; nothing below it touches
  `console` or `process.stdout`, which is what lets the unit tests read the byte stream back.

Unit tests live in `tests/github/` and `tests/reader/`, mirroring `src/`. There is deliberately no
`specs/001-prototype-issues-reader/tests/`: every case the spec enumerates is already asserted
black-box by `test.bash`, and a second Vitest copy of the same five cases would be duplication
masquerading as coverage.

## Decisions settled before implementation

Three came in with the work order, and they override what the generated half of the spec says. They
are recorded here because the spec's own text still reads the other way, and a reader will notice.

1. **`GITHUB_API_MODE` accepts `mock` and `real` — not `live`.** `Decisions already made` writes the
   live value as `'live'`; the committed `.env.example` writes it as `real`. `real` wins: the
   `.env.example` is the artefact a reviewer copies and runs, and a spec that disagrees with the
   runnable artefact loses to the artefact. Discrepancy noted rather than silently harmonised.
2. **`GITHUB_API_MODE` is required. No default.** The spec's `Open questions` recommends defaulting
   to `mock` when unset; that recommendation is overruled. A default that serves fake data to someone
   who believes they are looking at real issues is exactly the failure this project exists to guard
   against, and it costs one env var to make impossible. Unset → message naming the variable and its
   accepted values, exit 1, before any polling.
3. **`GITHUB_API_MODE=real` exits non-zero and never falls back to the mock.** `Not this` forbids
   real network calls, so there is no live path to run; the message says the live client arrives in a
   later spec. Falling back would reintroduce (2) by another route.

Plus one from the operator directly: **the first poll fires immediately at startup**, not after one
interval — "no reason to poll only after some time when we can fetch straight away".

## Choices nobody decided, taken here

- **The blank separator is emitted once, with the bar's first frame** — a single leading `\n` before
  `Polling .`, and never again. The bar is now one line redrawn in place, so a separator per tick
  would be new lines, which is what `In-place status bar` forbids.
- **The bar erases with spaces before every redraw** (`\r`, `renderedWidth` spaces, `\r`, frame)
  rather than padding the dots to a fixed width. Padding would be cheaper, but `Polling .  ` would
  mean the literal `Polling ...` never appears in the stream, and the check greps for all three
  phases verbatim.
- **The bar's first frame is drawn at startup**, then ticks every second. The 1s cadence is the
  spec's; drawing at t=0 rather than t=1s is mine, and it is what puts the blank-line separator and
  the first frame ahead of the first issue line no matter how fast the poll resolves.
- **`phase` always means the phase on screen.** `tick()` advances then redraws; `setError()` and
  `clearError()` redraw without advancing. So an error arriving between ticks does not make the dots
  jump a step.
- **Deduplication keys on GitHub's global `id`, not on `number`.** The operator's entry says "store
  the last issue's ID". Selection emits open issues with `id` greater than the last printed id, in
  ascending id order, and the marker advances only on issues actually printed — so a closed issue
  with a high id cannot skip an open one. The mock's ids ascend with issue number, so the two
  orderings agree.
- **Backoff is `interval * 2 ** consecutiveFailures`, uncapped.** At a 1s interval that polls at
  0s, 2s, 6s, 14s … and returns to the base interval on the first success. No ceiling: a ceiling is a
  threshold nobody set, and `Out of scope` explicitly rejects asserting the multiplier sequence
  beyond one minimum-elapsed check. **Known consequence:** after ~31 consecutive failures the delay
  exceeds `setTimeout`'s range and Node would fire it immediately. Unreachable against a static mock;
  it needs a decided cap before the live client lands.
- **Everything now goes to stdout, through the bar.** The failure text is no longer a stderr line
  but the bar's inline slot: `Polling .. Error: <provider message>`, carried across ticks and dropped
  the moment a poll succeeds. One stream is not a stylistic preference here — two streams have
  independent buffers, and the check compares the byte offset of `Error` against the byte offset of
  the first issue line, which is only meaningful if one writer ordered both.
- **Whitespace in an error message is collapsed to single spaces.** A provider message containing a
  newline would tear the bar off its single line, which is the one invariant the whole feature rests
  on. Unreachable with the current mock; it is the live client that will return HTML bodies.
- **The error text is the provider's message, verbatim apart from that.** `Out of scope` refuses to
  assert wording beyond the substring `Error`, so it is not truncated or reworded — a status bar that
  hides why it failed is the reason someone reads the status bar.
- **`GITHUB_REPO` and `POLL_INTERVAL_SECONDS` are required too**, on the same reasoning as (2) — no
  guessed interval, no guessed repository. `GITHUB_MOCK_FAIL_COUNT` is the one optional variable and
  defaults to 0, per the spec.
- **An empty or whitespace-only env value counts as unset.** `.env.example` ships
  `GITHUB_MOCK_FAIL_COUNT=` empty, so treating `''` as "not provided" is the only reading under which
  the shipped example runs.
- **`POLL_INTERVAL_SECONDS` accepts any positive finite number**, not only integers. Rejecting `0.5`
  would be a restriction nobody asked for; `0`, negatives and non-numbers are rejected.
- **`GITHUB_TOKEN` is not read at all.** It is in the spec's env list and the check exports it, but
  with no live client there is nothing to authenticate, and a parsed-and-unused field is dead weight.
  It belongs to the live-client spec.
- **The issue shape carries a modest subset of the REST payload** — `id`, `number`, `title`, `state`,
  `body`, `user`, `labels`, `html_url`, `created_at`, `updated_at`, `closed_at` — in the API's own
  snake_case, because the point of the fake is to mirror the wire shape. `user: null` and `body: null`
  appear in the dataset so the real API's nullable fields are represented from the start.
- **Configuration and unsupported-mode failures exit `1`.** The spec says non-zero; 1 is the choice.
- **`SIGINT`/`SIGTERM` clear both timers and exit 0.** Manual stop is the documented way this process
  ends, so it is not an error.

## The check reads `GITHUB_MOCK_FAIL_COUNT` from wherever it can find it

Part 1 asserts the happy path by leaving `GITHUB_MOCK_FAIL_COUNT` **unset** — it never exports a `0`.
So anything that supplies the variable behind the check's back turns part 1 red, and the failure
message is the misleading `missing open issue #1`. Two places did exactly that here:

- `.env`, which had `GITHUB_MOCK_FAIL_COUNT = 3` left over from eyeballing the inline error. Node's
  `--env-file` trims around the `=`, so the stray spaces do not save you, and the file is loaded by
  the `prototype-issues-reader` script itself. Set back to empty.
- the shell Claude Code was launched from, which had the whole `.env` exported into it. A shell
  export outranks `--env-file` and cannot be fixed from inside the repo; the check was run under
  `env -u GITHUB_MOCK_FAIL_COUNT` to get the clean environment it assumes.

At a 1s interval three simulated failures put the first success at 2+4+8=14s, well past part 1's 8s
window — which is why this presents as the implementation being broken rather than as a
misconfiguration. Worth knowing before debugging the reader.

## Retracted: the orphan the previous pass recorded

An earlier version of this note reported that `timeout Ns pnpm prototype-issues-reader` kills `pnpm`
without forwarding `SIGTERM` down the `pnpm → tsx → node` chain, leaving the reader polling forever.
Re-measured on pnpm 10.20 / Node 25: no orphan survives the `timeout`, after the acceptance check and
after the command on its own. The reader's `SIGINT`/`SIGTERM` handlers are reached. Nothing to work
around, so the claim is retracted rather than carried forward — but the process does run
indefinitely by design, so it is worth a `ps` check if a run ever looks stuck.

## Status

- `pnpm check` — green (typecheck, lint, format, 143 unit tests).
- `pnpm test 001` — exit 0, prints `PASS`; ~18s, three consecutive runs. Needs
  `GITHUB_MOCK_FAIL_COUNT` absent from the environment, per the section above.

`specs/*/spec.md` joined `specs/*/metrics/` in `.prettierignore`. The re-enrichment that added
`In-place status bar` also rewrote the summary tables in a narrower style that Prettier wants to
re-pad, so `format:check` went red on a file `CLAUDE.md` forbids editing. The metrics entry above it
already carries the reasoning: records written by the tooling are not source.

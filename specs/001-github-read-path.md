# 001 — Polling worker that reads issues and logs them

Status: draft
Covers: work-order step 0 in PLAN.md

## Goal

A worker that starts, polls a GitHub repository on an interval, reads its open issues and logs them.
Nothing else. This spec covers the mechanism only, run through `tsx`; putting it in a container is 002.

## Done when

- `GitHub` port with `listIssues()`, and an `Issue` type.
- `RealGitHub` implements it against the GitHub REST API.
- `FakeGitHub` implements it from a local stub, and can be told to fail, so backoff is testable.
- A worker that polls every `POLL_INTERVAL_MS` and logs one line per open issue.
- One test that runs the worker loop against `FakeGitHub` and asserts the logged fields, the
  immediate first pass, and the backoff behaviour.
- One test over the configuration rules below: each rejection case exits non-zero, and a valid pair
  is accepted.
- `pnpm check` exits 0.

## Configuration

| Variable           | Required | Meaning                                                       |
| ------------------ | -------- | ------------------------------------------------------------- |
| `GITHUB_REPO`      | yes      | `owner/repo`                                                  |
| `POLL_INTERVAL_MS` | yes      | milliseconds between passes                                   |
| `GITHUB_TOKEN`     | no       | raises the rate limit; required only for a private repository |

## Behaviour

**Which issues.** Open issues only, first page. No pagination.

**When it polls.** The first pass runs immediately on startup, not after the first interval. The
interval is the gap between passes, not a delay before the first one.

**What is logged.** One line per issue, carrying: number, title, author, state, labels, creation
date, URL. Not the body — it would flood the console.

**A failed pass never ends the process.** The worker logs the failure and keeps going, with a capped
exponential backoff: the wait doubles on each consecutive failure, up to a ceiling of ten times
`POLL_INTERVAL_MS`, and resets to `POLL_INTERVAL_MS` after the first pass that succeeds.

**Bad configuration does end the process**, before the loop begins, with a non-zero exit and a
message on stderr. The dividing line is who can fix the error. A failed request or an expired token
may recover on its own, so it is retried. A missing `GITHUB_REPO` never recovers, and a worker that
logs the same configuration error every interval looks alive while doing nothing — the non-zero exit
is what makes that failure visible from outside. Restarting afterwards belongs to whatever supervises
the process, and is out of scope here.

This follows the Kubernetes convention that a process fails fast and its supervisor owns the restart.
It is not a claim about the kubelet, which restarts a crash-looping container with backoff whatever
caused the crash.

Configuration is bad when `GITHUB_REPO` is absent, or is not exactly two non-empty segments
separated by one `/`; or when `POLL_INTERVAL_MS` is absent, or is not an integer greater than zero.

## Acceptance check

**Deterministic, and the one that must pass.** Against the stub, so it depends on neither the
network nor the state of anyone's repository:

```
pnpm test
```

Exits 0. The suite asserts that a pass against `FakeGitHub` logs one line per open issue carrying
every field listed above, that the first pass happens without waiting out the interval, and that
after a forced failure the next wait is twice the interval and returns to the interval once a pass
succeeds.

It also asserts each configuration rule, one case apiece: `GITHUB_REPO` absent, `GITHUB_REPO=foo`,
`GITHUB_REPO=a/b/c`, `GITHUB_REPO=a/`, `POLL_INTERVAL_MS` absent, `POLL_INTERVAL_MS=-5`,
`POLL_INTERVAL_MS=0`, `POLL_INTERVAL_MS=abc` — each exits non-zero before any request is made — and
that `GITHUB_REPO=a/b` with `POLL_INTERVAL_MS=1000` is accepted.

**Smoke, non-deterministic, and explicitly so.** Nothing else exercises `RealGitHub`, so without
this the suite stays green with broken HTTP:

```
GITHUB_REPO=<owner/repo> POLL_INTERVAL_MS=60000 pnpm worker
```

Logs one line per open issue of that repository, waits, and logs them again. It depends on a live
API and on which issues happen to be open, so it is read by a human, not asserted.

## Decisions already made

- **Unauthenticated by default.** Public issues read without a token. Anyone pointing the worker at a
  private repository supplies their own token.
- **`GITHUB_REPO` is `owner/repo`.** Not a clone URL — the REST API addresses `/repos/{owner}/{repo}`.
- **No state, so every pass logs everything.** Noisy on purpose. Skipping issues already seen needs a
  record of what was seen — the State primitive in `PLAN.md`, keyed by content hash — which is not in
  this step. The operator wants it eventually, so that two workers do not duplicate each other's
  work; it is not needed while nothing is spent and nothing is written.
- **The port carries no domain knowledge**, per ADR-0001. It fetches and normalises; it does not
  classify.
- **`RealGitHub` uses the global `fetch`.** No client library and no new runtime dependency: one
  request and one JSON parse. Octokit would bring a dependency tree to save perhaps fifteen lines.
- **`pnpm worker` runs the worker in development**, through `tsx`.
- **The log line is human-readable text**, not structured JSON. Nothing consumes the output as data
  yet; revisit when something parses it.
- **`Issue` carries the issue and nothing else** — the fields the log line names, and no comments.
  Comments are a second request and a second rate-limit cost per issue, and nothing in this step
  reads them. The classifier may need them; that is the spec that should pay for them.

## Out of scope

- The container, the `dist` build, the `Dockerfile`. That is 002.
- State, checksums, and coordination between two running workers.
- Any model call, and therefore any token accounting.
- Writing to GitHub.
- Pagination, and reading closed issues.
- Restarting the process after a configuration failure. That belongs to whatever supervises it.

## Amendments

- _2026-09-07_ — **Split.** This spec originally also covered the production image and its `tsc`
  build. It now covers the mechanism only, checked through `tsx`; the container moved to 002. The
  reason is the acceptance check: one spec covering both had a single check standing for two
  different claims, and neither was cleanly falsifiable. Two specs, two runnable checks.
- _2026-09-07_ — **Behaviour that was undefined is now defined.** The first draft said "reads its
  issues and logs them" without saying which issues, which fields, or what happens when a later poll
  fails. All three were gaps an implementer would have had to invent through. Now: open issues only,
  a named field list, and capped exponential backoff instead of exiting.
- _2026-09-07_ — **The stub gets a consumer.** `FakeGitHub` was in `Done when` with nothing running
  it. It now backs the deterministic acceptance check, and a live smoke run covers `RealGitHub`,
  which the stub otherwise leaves unexercised.
- _2026-09-07_ — **Startup behaviour was invented, and is now decided.** Review found that the first
  poll happening immediately rather than after one interval was assumed by 002's acceptance check
  and stated in neither spec — an implementer reading "polls every interval" as "waits, then polls"
  would have failed a check through no fault of the code. The operator settled it: poll immediately.
  "Malformed" was also undefined and is now spelled out.
- _2026-09-07_ — **The justification for exiting on bad configuration was wrong, and the rule had no
  test.** The spec claimed Kubernetes does not restart a container that fails on configuration. It
  does — a crash-looping container is restarted with backoff whatever caused the crash. The rule
  itself stands and the operator confirmed it, but on the accurate ground: the process fails fast
  because nothing it can do will fix a missing `GITHUB_REPO`, and a loop that logs the same error
  forever looks alive while doing nothing. Separately, review found the newly precise definition of
  bad configuration was asserted by nothing — `Done when` and the acceptance check now name each
  case.
- _2026-09-07_ — **Four assumptions became decisions, and the section holding them was removed.**
  Review found four choices nobody had been asked about — no client library, the script name, the log
  format, the `Issue` shape — stated as though agreed. They were first written into `Assumptions
taken`, which was itself the wrong move: that section is for questions an absent stakeholder would
  answer, and the operator was available. Asked instead, and all four were settled, so they now sit
  in `Decisions already made` and the spec carries no assumptions at all.

# 001 — Polling worker that reads issues and logs them

Status: draft
Covers: work-order step 0 in PLAN.md

## Goal

A worker that starts, polls a GitHub repository on an interval, reads its issues and logs them.
Nothing else. It ships as a production container image so that a reviewer can run it without a Node
toolchain, which is the reason the container is in scope at all — see the amendment to `PLAN.md`
dated 2026-09-06.

## Done when

- `GitHub` port with `listIssues()`, and an `Issue` type.
- `RealGitHub` implements it against the GitHub REST API using global `fetch`. No new runtime
  dependency.
- `FakeGitHub` implements it from a local stub, for dev and tests.
- A worker that polls every `POLL_INTERVAL_MS` and logs each issue it reads.
- `tsc` emits to `dist/`; the image runs the compiled output.
- `Dockerfile` at the repository root.
- `pnpm check` exits 0.

## Configuration

| Variable           | Required | Meaning                                                       |
| ------------------ | -------- | ------------------------------------------------------------- |
| `GITHUB_REPO`      | yes      | `owner/repo`                                                  |
| `POLL_INTERVAL_MS` | yes      | milliseconds between passes                                   |
| `GITHUB_TOKEN`     | no       | raises the rate limit; required only for a private repository |

## Acceptance check

```
docker build -t collinson-issue-tracker .
docker run --rm -e GITHUB_REPO=<owner/repo> -e POLL_INTERVAL_MS=60000 collinson-issue-tracker
```

Logs the repository's issues, waits the interval, logs them again. Exits non-zero with a message on
stderr if `GITHUB_REPO` or `POLL_INTERVAL_MS` is missing, or if the repository cannot be read.

## Decisions already made

- **The image is production.** It runs compiled output from `dist/` and uses `RealGitHub` only.
  `tsx` and `FakeGitHub` are for development and tests, outside the image's path.
- **Unauthenticated by default.** Public issues read without a token. Anyone pointing the worker at a
  private repository supplies their own token.
- **`GITHUB_REPO` is `owner/repo`.** Not a clone URL — the REST API addresses `/repos/{owner}/{repo}`,
  and accepting both forms is machinery for no gain here.
- **No state, so every pass logs everything.** Noisy on purpose. Skipping issues already seen needs a
  record of what was seen — the State primitive in `PLAN.md`, keyed by content hash — which is not in
  this step.
- **The port carries no domain knowledge**, per ADR-0001. It fetches and normalises; it does not
  classify.

## Out of scope

- State, checksums, and coordination between two running workers. Real once a worker spends tokens or
  writes to GitHub; nothing in this step does either. Deferred deliberately, not overlooked.
- Any model call, and therefore any token accounting.
- Writing to GitHub.
- `docker compose`, a database, deployment to a public address.

## Amendments

_None yet._

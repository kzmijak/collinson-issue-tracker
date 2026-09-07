# 002 — Production container image for the worker

Status: draft
Covers: work-order step 0 in PLAN.md

## Goal

The worker from 001 runs as a container image, on my machine and on my server, and can be started by
a reviewer who has cloned this repository and has Docker — with no Node toolchain, no `pnpm install`
and no credentials. That last clause is the reason the container is in scope at all, per the
amendment to `PLAN.md` dated 2026-09-06.

## Done when

- `tsc` emits to `dist/`, driven by a `build` script in `package.json`.
- `Dockerfile` at the repository root, building an image that runs the compiled entrypoint.
- `pnpm check` exits 0 — it covers the `build` script's output, since `typecheck` and the test suite
  run over the same sources the image compiles.

## Acceptance check

From a clean clone, with no `.env` and no GitHub account:

```
docker build -t collinson-issue-tracker .
```

Exits 0. Then:

```
docker run --rm --name issue-worker \
  -e GITHUB_REPO=<owner/repo> -e POLL_INTERVAL_MS=60000 collinson-issue-tracker
```

Within ten seconds, stdout carries one line per open issue of that repository, each with the number,
title, author, state, labels, creation date and URL specified in 001. The ten seconds are meaningful
because 001 requires the first pass to run immediately on startup rather than after an interval.
After the interval the same lines appear again. `docker stop issue-worker` ends it.

This check reads a live repository, so which issues appear is not fixed; what is asserted is the
line-per-open-issue shape and the repeat after the interval. The deterministic check on the stub
lives in 001 and is what `pnpm test` covers.

Failure paths, per 001's configuration rules. Each exits non-zero with a message on stderr and
nothing on stdout, and each uses `--rm` and no `--name`, so it cannot collide with a container left
running by the check above:

```
docker run --rm -e POLL_INTERVAL_MS=60000 collinson-issue-tracker
docker run --rm -e GITHUB_REPO=<owner/repo> collinson-issue-tracker
```

The full set of rejected values is 001's business and is asserted by `pnpm test`; what this check
proves is that the image surfaces the exit code rather than swallowing it.

## Decisions already made

- **The image is production.** Compiled output from `dist/`, `RealGitHub` only. `tsx` and
  `FakeGitHub` are the development path.
- **Unauthenticated by default**, per 001. `GITHUB_TOKEN` is passed in only for a private repository
  or to raise the rate limit.
- **Configuration is environment variables**, per 001. The image bakes in no repository.
- **A configuration failure exits rather than retrying**, per 001. Restarting after that exit is the
  supervisor's job, and no restart policy is configured here.
- **The acceptance check allows ten seconds** for the first line to appear. The check needs a bound
  or it cannot be failed; 001 makes the first pass immediate, so the window covers container start
  plus one API call with room to spare. It is not a performance target.
- **The image is `collinson-issue-tracker`, the container `issue-worker`.** The check has to name
  both to be runnable, and `docker stop` needs a target.
- **The compile script is `build`.**
- **`POLL_INTERVAL_MS=60000` in the checks above is 001's smoke value**, reused so the two specs
  demonstrate the same thing. It is a fixture, not a default — the image bakes in no configuration.

## Out of scope

- `docker compose`, a database, a registry, CI, orchestration, restart policies, healthchecks. The
  first four follow from `PLAN.md`'s "no deployment pipeline"; the last two are my reading of the
  same line rather than anything it says.
- Publishing the image or deploying it to a public address.
- Anything from 001's out-of-scope list, which still holds.

## Amendments

- _2026-09-07_ — **Created by splitting 001.** 001 originally carried the mechanism and the image
  together, under one acceptance check that stood for two different claims. Split so each has a
  check that can be run and failed on its own: 001 through `tsx` and the stub, 002 through Docker.
- _2026-09-07_ — **The acceptance check was not satisfiable as written.** It asserted output within
  ten seconds while the interval was sixty, which only works if the first poll is immediate —
  something neither spec stated. 001 now says it explicitly and this check cites that. Review also
  caught `docker stop` with no container to stop, and a claim that the image contains no `tsx` that
  nothing measured; the first is fixed with a name, the second removed.
- _2026-09-07_ — **Three assumptions became decisions, and the section holding them was removed.**
  The ten-second window, the image and container names and the script name were mine and were
  sitting in the spec as though settled. Recording them under `Assumptions taken` was itself wrong —
  that section is for questions an absent stakeholder would answer, and the operator was available.
  Asked instead; all three were settled, so the spec now carries no assumptions.

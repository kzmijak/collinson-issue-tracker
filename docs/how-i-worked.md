# How this was built

Written by Claude Code from the run records. Every number below comes from
`specs/*/output/metrics/`, which the framework writes on each run; nothing here is estimated.

## The short version

I did not hand-write the tracker. I wrote specifications and acceptance criteria in prose, and a
framework I built for this exercise turned them into code through four agents: an enricher that
designs, an ACCS author that writes the acceptance check, a verifier that reviews both, and an
implementer that builds until the check passes. Every run leaves a report with its cost, its verdict
and its reasoning, so the decisions below are traceable rather than remembered.

## What it cost

| spec                  | enrich             | verify             | apply             |
| --------------------- | ------------------ | ------------------ | ----------------- |
| 001 prototype reader  | 6 runs · 911k ET   | 6 runs · 233k ET   | 2 runs · 1.80M ET |
| 002 proactive tracker | 21 runs · 2.59M ET | 19 runs · 1.39M ET | 7 runs · 8.05M ET |
| 003 classifier        | 5 runs · 547k ET   | 5 runs · 210k ET   | 3 runs · 2.23M ET |
| 004 harness           | 5 runs · 665k ET   | 4 runs · 218k ET   | 3 runs · 724k ET  |

86 runs, 19.6M effective tokens in total. Effective tokens weight cached reads at 0.1, cache writes
at 1.25 and output at 5, then multiply by the model's own cost, so one number compares a cheap
chatty run against an expensive terse one.

Outcomes across those runs: 8 approvals, 19 rejections by the verifier, 7 rejections by the
implementer, 8 blocked implementations, 4 runs stopped by their own budget ceiling.

## What the process caught that a person would not have

- **The acceptance check that could never pass.** Spec 002's check compared a `cp` snapshot against a
  `head -n` re-read of the same log. The status bar never ends in a newline, so the two could never
  match. No implementation of any quality would have turned it green. The implementer found it,
  reported it with the exact lines, and refused to write code around it.
- **A check that agreed with itself instead of with the world.** Spec 003's first check called
  `/repos/:owner/:repo/issues/:id/comments`. The mock serves the flat path. The check would have
  failed for every possible implementation.
- **A real bug in the product, found by an agent reading its own failure.** The mock's growth timer
  ran at 4000ms, filling the dataset in 20 seconds against the 10 the spec asked for.

## What it cost me to learn

Spec 002 took 8 million effective tokens across seven implementation runs. Almost none of that was
spent on the feature. It went on an acceptance check that was subtly wrong in a new way each round:
a port that two specs disagreed about, a process group that was never killed so the next run talked
to the previous mock, an uninitialised awk variable that failed the first comparison every time.

Three changes came out of that, and all three are in the framework now:

- **A hard ceiling, not just an advisory one.** The model is told its budget, but one run went 25%
  past it. Now the run is aborted at a limit above the budget, and if the check passes anyway the run
  still counts as converged.
- **The implementer can send a spec back.** It used to have no way of saying "the check is wrong",
  so it burned entire budgets trying to satisfy an impossible one. It now returns findings and a
  range of fire, exactly as the verifier does, and the spec goes back to draft.
- **Specs export their decisions.** Ports, environment variables and endpoint shapes now travel from
  one specification to the next, because spec 002 silently renamed a port and spec 001's frozen check
  had been failing ever since.

## What I would do differently

- **Force the output shape instead of asking for it.** Agents answer with JSON because a prompt says
  so, and one enricher answered with a finished document instead. 75k effective tokens went to a
  parse error. The SDK can enforce a schema through a tool call; I ran out of time to switch.
- **Keep the acceptance check out of bash.** Every expensive failure in this repo was a shell script
  problem, not a product problem.
- **Watch the blast radius of cleanup code.** A stray-process sweeper I added to kill servers the
  checks leave behind turned out to kill anything started in the repository during a check. It is
  removed; the orphan processes are a nuisance, the sweeper was a hazard.

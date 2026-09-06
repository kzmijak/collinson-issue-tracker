# 0002 — The delivery stage produces a plan, not executed code

Status: accepted · 2026-09-06

## Context

The natural end of an issue-triage pipeline is to fix the issue: delegate to an agent, let it write
code, open a pull request. It is the most demonstrable feature in the design and the most tempting
to build.

## Decision

The delivery stage emits a **fix plan and a cost estimate**. It does not write code and it does not
open pull requests.

## Consequences

- The harness can score it. Plan quality and estimate accuracy are measurable; generated code that
  nothing evaluates is not.
- Budget metering stays meaningful. A plan has a bounded cost that can be compared against the
  classifier's earlier estimate, which is the estimate-versus-actual measurement this project treats
  as its headline result.
- The system cannot close the loop autonomously. That is a real capability gap and it is deliberate.

## Reasoning

An agent that reliably fixes arbitrary issues is a harder product than the one being built, and the
harness measures none of it. Every hour spent there is an hour not spent on the part the exercise
ranks first.

There is also an evaluation argument. A plan is a _comparable artifact_: two configurations produce
two plans for the same issue, and they can be scored against each other and against actual spend. A
merged pull request is not comparable in the same way — its quality is confounded with the repository
it landed in, and a failed one leaves state behind. Scoring the plan isolates the decision, which is
what this project is measuring.

## Note

An earlier revision of this decision leaned on a second argument: that the repository ran under a
protocol forbidding agents from producing code unsupervised, so an autonomous pull-request bot would
be self-contradictory. That protocol was dropped — supervising the agent by hand contradicts the
premise that confidence comes from measurement rather than oversight. The decision stands on the
scope and comparability arguments alone.

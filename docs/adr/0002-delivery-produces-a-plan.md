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

Two arguments, and the second is the stronger one.

First, scope: an agent that reliably fixes arbitrary issues is a harder product than the one being
built, and the harness measures none of it.

Second, consistency: this repository runs under a Code Production Protocol (`CLAUDE.md`) stating that
code is never produced proactively — it is the artifact of a design agreed first, emitted for review,
and transcribed only on explicit instruction. A bot that silently opens pull requests is precisely
what that document forbids. Shipping both would mean the project does not believe its own governing
rule.

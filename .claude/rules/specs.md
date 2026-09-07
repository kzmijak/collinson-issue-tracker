---
paths:
  - 'specs/**'
---

# Writing a Spec

`CLAUDE.md` carries the method — spec before code, amendments in their own commit, just-in-time,
falsifiable, scope discipline. This file carries the part that is not obvious from the method and
that has already been got wrong once.

## A spec is the closing artifact of a consultation

It contains what the operator and the session actually agreed. No less, and emphatically no more.

Not in a spec: invented acceptance checks, file layouts, field lists, script names, thresholds,
error paths or out-of-scope items that never came up in the conversation. A spec built mostly from
inference asks the operator to review the agent's invention wearing the costume of an agreed
contract, which inverts the direction of the whole method.

The test before writing: **for each line, name the exchange it came from.** A line you cannot trace
is a question, not a decision.

## Cascade doubts, do not resolve them

A doubt held before writing, or discovered while writing, goes back to the operator **before the
spec is finished**. In plain text, in one batch, each with a recommendation.

`CLAUDE.md` says "surface gaps, do not invent through them". Surface means _to the operator_, not
in prose after the fact.

`Assumptions taken` is for questions an absent stakeholder would have answered — the brief's own
framing. It is not a place to record decisions the operator was available to make and was not
asked. Nor is it a receipt for a choice already made unilaterally.

This applies to `PLAN.md` amendments too. Cutting scope to pay for new scope is the operator's call.

## Falsifiable, and only that

The bar from `specs/README.md`: two people read the spec and the implementation and can disagree
about whether it is satisfied. Below that bar the spec is decoration; above it, by adding detail
nobody asked for, it is scope.

Prefer an acceptance check that is a command with an expected result. When a step cannot be checked
by running something, say how it is verified instead — and say that it cannot.

## Amendments

When reality contradicts the spec, amend it in its own commit and say what forced the change. A
spec with no amendments reads as a spec written after the fact. This is the most valuable entry in
the trail and the easiest to skip.

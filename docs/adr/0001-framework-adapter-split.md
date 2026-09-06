# 0001 — The framework is scaffolding; the adapter is the deliverable

Status: accepted · 2026-09-06

## Context

The exercise asks for a small triage service and, more importantly, an evaluation harness. It also
says the decisions about scope and approach are themselves part of what is being assessed, and that
the choice of tooling is interesting in its own right.

That framing makes a straightforward "build a classifier, measure it" submission weaker than it
looks. A classifier that is one prompt has one meaningful axis — model size — and measuring it
produces a table everyone else will also have. The measurement is only as interesting as the thing
being measured.

## Decision

Split the system in two.

**Framework** — six repo-agnostic primitives: meter, state, observer, policy resolver, classifier,
gate. No domain knowledge, no policy content. Commodity scaffolding, largely AI-generated.

**Adapter** — a directory of policy documents plus a config file, per target repository. Category
taxonomy, urgency bands, budget ceilings, gate configuration.

The harness measures the adapter. The framework is the substrate it runs on.

## Consequences

- Configurations become meaningful. Stages on or off, policy on or off, model and effort per stage
  are all real variants that trade against each other, which is what makes a cost/quality frontier
  worth plotting.
- The seam has to stay narrow — an adapter is data, not code — or the claim is not credible.
- The framework being generated is acceptable and stated openly, but it still has to be _verified_.
  If token accounting is subtly wrong, every adapter measurement is wrong and the actual deliverable
  is invalidated. Hence the cost smoke test as step one.
- Every new framework seam has to justify itself by what it lets the harness measure. A primitive
  that exposes no measurement is scope.

## Alternatives considered

**A single monolithic classifier.** Simpler and faster, and the brief does say to keep the service
simple. Rejected because "simple" was aimed at not burning time on the service, not at making the
harness trivial — and a toy service yields a toy harness.

**A full autonomous bot** (webhook, approval flow, agent-authored pull requests). Rejected: it is
mostly delivery plumbing, none of which the harness scores, and it inverts the exercise's stated
priorities. See ADR-0002 for the related decision on the delivery stage.

# Adapters

One directory per target repository. An adapter is **data, not code** — that constraint is what makes
the framework/adapter split in ADR-0001 credible.

```
adapters/<repo>/
├─ policies/*.md   ← the rules, written to be falsifiable
└─ config.json     ← categories, urgency bands, budget ceiling, gate mode, repo link
```

## Writing a policy

A policy has to be specific enough that two people can label an issue against it and disagree. That
is the bar, and it exists because **the policy document is also the labelling rubric** for the
evaluation set — see the README. A rule that reads like a mission statement cannot be labelled
against and cannot be measured.

The shape to copy is in `notes/ref-policy-format/`: an id, a trigger condition, and a content block
written as an enforceable rule. Compare:

- ❌ "Issues should be on-topic and constructive."
- ✅ "An objection must name one falsifiable problem and propose a concrete alternative, or state the
  conditions under which the objector would change their mind. A bare rejection is not an objection."

## Planned adapters

- **primary** — a large public repository with real issue volume. The evaluation set is drawn from it.
- **self** — this repository. A minimal adapter, present to demonstrate that the seam is real. It is
  not a dataset; there are not enough issues here for that.

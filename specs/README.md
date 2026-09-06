# Specifications

The executable layer. `PLAN.md` says what the system is and why; a spec says what to build next and
how we will know it worked. One spec per work-order step, committed **before** its implementation.

Numbered sequentially: `001-meter-and-llm-port.md`, `002-...`. The number is the order they were
written, not a priority.

## Why the commit order matters

The specs and the implementations that follow them are the progression record this exercise asks
for, and git timestamps are the evidence. A spec committed in the same commit as its code, or after
it, reads as reconstruction — which is the opposite of what it is meant to demonstrate. So:

```
spec(harness): per-field metrics and acceptance checks
feat(harness): implement metric computation per 003
spec(harness): revise — urgency MAE needs per-class N, not aggregate
fix(harness): report per-class N per revised 003
```

**Amendments are the most valuable entries.** A spec that was never revised looks like a spec
written after the fact. When reality contradicts the spec, amend it in its own commit and say what
changed the decision.

## Template

```markdown
# NNN — <title>

Status: draft | active | done | superseded by NNN
Covers: work-order step N in PLAN.md

## Goal

One paragraph. What capability exists after this that did not before, and why it is next.

## Done when

Concrete and checkable. Files that exist, exports they carry, commands that run.

- `src/...` exports `X`
- `pnpm ...` prints ... / exits 0

## Acceptance check

The command a reader can run, and what it should produce. If a step cannot be checked by running
something, say how it is verified instead — but prefer a command.

## Decisions already made

So the implementer does not re-make them. Cite ADRs and PLAN.md where they apply.

- ...

## Assumptions taken

Open questions this spec had to answer without a stakeholder. State the question and the choice.
These roll up into the README's assumptions section.

- **Question:** ... **Assumption:** ... **Why:** ...

## Out of scope

What this step must _not_ do. Usually the more useful half — it is what stops an agent being
helpful in an expensive direction.

- ...

## Amendments

Appended as they happen, newest last. Each says what changed and what forced the change.

- _(date)_ ...
```

## Just-in-time

Write the spec for step N, build it, then write N+1 with what you learned. Do not write the whole
sequence up front — in a time-boxed exercise the ceremony becomes the work, and eight polished specs
against three implementations is the wrong trade.

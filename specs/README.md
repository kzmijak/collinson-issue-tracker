# Specifications

The executable layer. `PLAN.md` says what the system is and why; a spec says what to build next and
how we will know it worked. One spec per work-order step, committed **before** its implementation.

One directory per spec, numbered in the order they were written rather than by priority:

```
specs/001-<slug>/
├─ spec.md      ← the spec
├─ tests/       ← what proves this spec, as opposed to what proves a module
└─ test.bash    ← the whole verification procedure, one entry point
```

`test.bash` exists because not every spec can be proved by Vitest — a container spec is a build, a
run and an assertion about stdout. It exits `0` for passing, `1` for failing and `2` for "could not
run here", which the caller must treat differently: a missing Docker on a reviewer's machine is not
a failing implementation.

Unit tests stay in `tests/`, mirroring `src/`. They answer "does this module work". A spec's own
tests answer "is this spec satisfied". Two different questions.

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

`999-spec-template.md`. Copy it to `specs/NNN-<slug>/spec.md` and fill in `What I want`.

The shape in one paragraph: **you write prose, the tool writes structure.** `What I want` is yours —
dated entries, appended, never edited once written, because that section is the record of what was
decided and when. Everything below the generated marker is produced by `pnpm enrich` from those
entries: the four-row summary a reader must read, the examples, the acceptance check. Anything
`enrich` cannot derive comes back as an open question instead of being guessed at.

The rules that make it work are in `.claude/rules/specs.md`.

## Just-in-time

Write the spec for step N, build it, then write N+1 with what you learned. Do not write the whole
sequence up front — in a time-boxed exercise the ceremony becomes the work, and eight polished specs
against three implementations is the wrong trade.

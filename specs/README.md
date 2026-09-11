# Specifications

How specs work is in `.ai/context.md`: SDD Framework Goals, Components and the Dictionary. This page is
only the layout.

```
specs/NNN-<slug>/
├─ spec.md                  ← yours: What I want, dated entries, only ever appended to
├─ accs.md                  ← yours: how to check that the world matches, edited in place
└─ output/                  ← written by agents; nothing here is edited by hand
   ├─ enriched-spec.md      ← the expanded spec, with its hash and review status
   ├─ accs.bash             ← the ACCS, translated from accs.md, plus any helper it needs
   └─ metrics/              ← one JSON report per enrich, verify and apply run
```

Specs are numbered in the order they were written.

## Starting a spec

Copy `999-spec-template.md` to `specs/NNN-<slug>/spec.md` and write the first entry under What I
want. Write `accs.md` next to it — `pnpm enrich` refuses without one. Then `pnpm enrich NNN`,
`pnpm verify NNN`, `pnpm apply NNN`.

## Changing a spec

In `spec.md`, append a new dated entry, a breakpoint. Never edit one that is already there.
`accs.md` is edited in place; git keeps its history. Either change makes the next `enrich`
regenerate everything, and `verify` and `apply` refuse to act until it has run.

## ACCS and unit tests

The ACCS answers "does the world match this spec". It drives the system from the outside — commands,
environment variables, HTTP, stdout, stderr, exit codes — and never names anything inside `src/`. It
exits `0` when the world matches and `1` when it doesn't. A check that hangs counts as `1`.

Unit tests answer "does this module work". They live in `tests/`, mirror `src/`, and are written by
the implementer. The ACCS never runs them.

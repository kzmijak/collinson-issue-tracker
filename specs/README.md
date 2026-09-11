# Specifications

How specs work is in `CONCEPT.md`: SDD Framework Goals, Components and the Dictionary. This page is
only the layout.

```
specs/NNN-<slug>/
├─ spec.md     ← What I want (yours), then everything below the marker (pnpm enrich)
├─ accs.bash   ← the acceptance criteria check script, written by pnpm enrich
├─ …           ← any helper file the ACCS needs, also written by pnpm enrich
└─ metrics/    ← one JSON report per enrich, verify and apply run
```

Specs are numbered in the order they were written.

## Starting a spec

Copy `999-spec-template.md` to `specs/NNN-<slug>/spec.md` and write the first entry under What I
want. Then `pnpm enrich NNN`, `pnpm verify NNN`, `pnpm apply NNN`.

## Changing a spec

Append a new dated entry, a breakpoint. Never edit one that is already there. The next `enrich`
picks the change up, and `verify` and `apply` refuse to act until it has run.

## ACCS and unit tests

The ACCS answers "does the world match this spec". It drives the system from the outside — commands,
environment variables, HTTP, stdout, stderr, exit codes — and never names anything inside `src/`. It
exits `0` when the world matches, `1` when it doesn't, and `2` when it couldn't decide.

Unit tests answer "does this module work". They live in `tests/`, mirror `src/`, and are written by
the implementer. The ACCS never runs them.

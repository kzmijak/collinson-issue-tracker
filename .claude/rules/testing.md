---
paths:
  - '**/*.test.ts'
  - '**/*.spec.ts'
---

# Testing Rules

- Unit and integration tests: Vitest, node environment.
- Dependency injection with Fake/Real implementations. `FakeGitHub` reads from a stub and can be
  told to fail; `RealGitHub` calls the API. Tests run against the Fake, so they depend on neither
  the network nor the state of anyone's repository.
- Naming: `describe` per module or function, `it` describing behaviour in plain English.
- **Two kinds of test, two locations.** `tests/` mirrors `src/` and answers "does this module work".
  `specs/NNN-<slug>/tests/` answers "is this spec satisfied" — the cases the spec enumerates, one
  apiece. Never inside `src/`.
- A spec's whole verification runs through `specs/NNN-<slug>/test.bash`, one entry point, because not
  every spec is provable by Vitest — a container spec is a build, a run and an assertion on stdout.
  It exits `0` passing, `1` failing, `2` could-not-run-here; the caller must not treat `2` as a
  failing implementation.
- **One entry point does not mean one kind of proof inside it.** `test.bash` should call the fast
  Vitest suite for whatever it can prove without a real process — a dot-cycle schedule, a backoff
  doubling, a format string — and reserve its own slower section for what only a real process
  proves: that the entrypoint exists, that a config error exits non-zero before doing work, that
  bytes on stdout actually look the way the fast suite assumed. A `test.bash` that re-derives
  timing or formatting logic byte-by-byte against a live process is proving the same thing twice,
  slowly and with a clock in the loop instead of a fake timer. Spec 001's first `test.bash` did
  this and ran to two long, wall-clock-bound sections; the reader's own `startReader.test.ts` proves
  the backoff schedule in milliseconds on fake timers, which is the version of this proof that
  belongs in a check run every round of `pnpm apply`.
- **Every case the spec enumerates exists as a test, with its literal value.** A spec naming
  `GITHUB_REPO=a/b/c` and a suite that never mentions it is a hole the acceptance check cannot see —
  and the check is also what decides whether there is anything left to implement.
- LLM calls are not mocked away wholesale — a fake `Llm` returning recorded responses keeps the
  parsing, metering and policy layers under test. Mocking the whole pipeline tests nothing.
- Quality focus: fast tests > catching real problems > coverage.
- False confidence is worse than no tests. A green suite with unfalsifiable assertions is a FAIL.

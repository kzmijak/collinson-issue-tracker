---
paths:
  - '**/*.test.ts'
  - '**/*.spec.ts'
---

# Testing Rules

- Unit and integration tests: Vitest, node environment.
- Dependency injection with Fake/Real implementations. `FakeGitHub` records what would have been
  posted; `RealGitHub` posts. Tests run against the Fake.
- Naming: `describe` per module or function, `it` describing behaviour in plain English.
- Test file location: `tests/`, mirroring `src/`. Never inside `src/`.
- LLM calls are not mocked away wholesale — a fake `Llm` returning recorded responses keeps the
  parsing, metering and policy layers under test. Mocking the whole pipeline tests nothing.
- Quality focus: fast tests > catching real problems > coverage.
- False confidence is worse than no tests. A green suite with unfalsifiable assertions is a FAIL.

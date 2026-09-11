# Plan

What the system is, the roadmap stages and the rules of the method live in `CONCEPT.md`, which is
written by hand. This file doesn't restate any of it. It tracks where the work stands and records how
the plan changed.

## Where things stand — 2026-09-11

There are two tracks.

**SDD framework** (`src/sdd-framework/`). `pnpm enrich`, `verify`, `apply` and `commit` work end to
end. On 2026-09-11 the code was synced with the concept:

- the check script is called ACCS (`accs.bash`, `pnpm enrich:accs`)
- spec statuses are `draft` / `approved` / `rejected`
- `verify` and `apply` refuse a spec whose operator section changed after it was enriched
- `apply` has a 900k effective-token ceiling, and starts no new round after 30 minutes

The framework has no specs of its own. That is by design.

**Issues Tracker assessment.** Restarted from zero on 2026-09-11. Only one spec existed, so it was a
cheap moment to clean up. The first reader prototype, its fake GitHub and every agent output for
spec 001 were deleted. The operator section of spec 001 was kept and will be regenerated.

## Roadmap

| Stage       | GitHub side                    | Tracker side                                 | Spec                   | Status      |
| ----------- | ------------------------------ | -------------------------------------------- | ---------------------- | ----------- |
| Prototype   | Readonly Fake GitHub Service   | Idle Issues Tracker                          | 001, to be regenerated | not started |
| Early-alpha | In-Memory Stateful Fake GitHub | Proactive Issues Tracker                     | —                      | not started |
| Alpha       | In-Memory Stateful Fake GitHub | Issues Classifier                            | —                      | not started |
| Beta        | Prod GitHub                    | Issues Classifier, Issues Classifier Harness | —                      | not started |
| Release     | Prod GitHub                    | Containerized Issues Classifier, Harness     | —                      | not started |

## Parked questions

- **The classification rubric.** Deliberately not written yet. The first rounds of the tracker are
  there to show what real issues look like, and the rubric comes after that.
- **Harness scoring.** Weighted hits per field. The weights aren't set yet. They get decided when the
  harness is designed.
- **Where the classifier gets its LLM client.** The client lives in `src/sdd-framework/llm/`, which is
  outside the implementer's read boundary. This needs deciding before Alpha.

## How the plan changed

The first plan was written on 2026-09-06 and amended on 2026-09-07. It's in git history before
2026-09-11. It described a triage framework of six primitives — meter, state, observer, policy
resolver, classifier, gate — plus one adapter per target repository, holding policy documents and
config. Its thesis was "the adapter is the assessment". It planned a hand-labelled test set of about
60 issues, and a delivery stage that only ever produced fix plans.

Here is what replaced it:

- **The SDD framework became a track of its own.** I'm building it for my own use, and the assessment
  is where it gets proven. The earlier triage "framework" and the adapters are gone.
- **The work is split into five stages**, each built through the framework: fake GitHub first, real
  GitHub from Beta on.
- **The harness arrives in Beta.** The goal is to reach Beta fast. The test set is built by hand from
  issues the tracker has actually seen, so it can't come first.
- **The delivery stage no longer stops at a plan.** In Beta, a rocket reaction on a classified issue
  starts a dev agent working on the fix. This reverses ADR-0002.
- **The container is back in scope**, as the Release stage.

ADR-0001 (framework and adapter split) and ADR-0002 (delivery produces a plan) stay in `docs/adr/` as
the record of that first direction.

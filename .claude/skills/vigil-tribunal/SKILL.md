---
name: vigil-tribunal
description: Test quality vote — QA, tester, reviewer agents evaluate test scenarios, coverage, assertions, and flakiness (with R2 gate by QA Head)
user-invocable: true
---

# Vigil Tribunal

Test quality vote by three agents governed by the Constitution. Before first use in a session, read `CONSTITUTION.md` in this skill's directory (`.claude/skills/vigil-tribunal/CONSTITUTION.md`) — it defines member roles, voting procedure, R2 gate mechanics, and domain veto rules.

## Input

User provides test files or test scenarios to evaluate. Can include: spec files, coverage reports, test plans, or a feature description needing test strategy.

## Procedure

### Round 1

1. Spawn all 3 agents **in parallel** (qa, tester, reviewer) with identical prompt:
   - State what is being evaluated (test files, scenarios, coverage)
   - Include the test code and/or production code under test
   - Ask each to evaluate from their domain perspective

2. Collect all 3 evaluations and present as table:

| Agent    | Verdict | Key findings |
| -------- | ------- | ------------ |
| QA       | ...     | ...          |
| Tester   | ...     | ...          |
| Reviewer | ...     | ...          |

3. Evaluate result:
   - **Clear majority (2:1 or 3:0) with QA in majority**: Decision is final.
   - **2:1 with QA in minority**: Trigger R2 Gate.

### R2 Gate

4. Spawn **one** QA agent with R1 results: "R1 ended [result]. Here are all arguments: [summary]. As Head of Tribunal, do you call Round 2? If yes — provide your argument. If no — escalate to project owner."

5. If QA says **no R2**: Present deadlock to user for decision.
6. If QA says **yes R2**: Proceed to Round 2.

### Round 2

7. Spawn all 3 agents **in parallel** with QA's argument included as context.
8. Present results. If still deadlocked: escalate to project owner.
9. Round 2 may be called only **once per topic**.

### Optional: Architect Advisory

If a standing member requests an advisory (and another seconds), spawn the **architect** agent before
Round 1 with the question: "Do these scenarios test what the harness actually depends on?" The
architect's output becomes context for Round 1, but the architect does not vote.

## Rules

- All agents get identical context — no bias
- Orchestrator does NOT vote — only synthesizes results
- Per Constitution: bare "no" not permitted, name the gap not the feeling, verify before asserting
- False confidence is worse than no tests — a green suite with unfalsifiable assertions is a FAIL
- User can override any decision (project owner override)

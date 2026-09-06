# Collinson Issue Tracker

LLM-powered GitHub issue triage service + evaluation harness. Take-home exercise submission.
Public repository — everything committed here is read by a reviewer.

## Mandate

Two deliverables, in this order of importance:

1. **The reasoning trail.** Planning notes, decision records, the record of how the work was
   actually done. This is ranked above the code by the people reading it.
2. **The service and the harness**, plus a README covering what was built, how to run it,
   what the eval results showed, and which assumptions were made.

The harness is the centre of gravity, not the service. The service exists to give the harness
something to measure. A harness that measures one thing well beats one that measures five loosely.

Quality is not the only axis. A change that is more accurate but three times the price is a real
trade-off and must be visible in the numbers the harness reports.

## Language

English, everywhere and without exception. Conversation with the operator, thinking, notes,
questions, code, comments, documentation, commit messages, README. Nothing in this repository
or in any session working on it is written in another language.

---

## Code Production Protocol

**This is the governing rule of this repository. It overrides default assistant behaviour.**

Code is never produced proactively, speculatively, or as a draft. Code is an **artifact**: the
final output of a design that was worked out jointly, in conversation, before a single line
existed. It is not a scratchpad, not a starting point for discussion, and not a way to find out
what the design should be.

The default state is: **no code is written.** Producing code requires having passed the gates below.

### What counts as code

Implementation source, tests, fixtures, schemas, configuration with behaviour in it, shell
scripts. If it executes or is consumed by something that executes, it is code and this protocol
applies to it.

Prose does not: notes, decision records, question lists, plans, README text, tables of results.
Those are the reasoning trail and are written freely.

### Phase 1 — Design, together

Before anything is emitted, the operator and the assistant work out, in dialogue:

- what the thing must do, stated as behaviour and not as implementation;
- its structure — the pieces, their responsibilities, the boundaries between them;
- its rules — the invariants, the edge cases, what happens when input is wrong;
- what is explicitly **out of scope**.

The assistant contributes by asking, proposing, and challenging — not by writing code to
illustrate a point. A code sample is not a legitimate move in a design conversation here.
If an idea needs a shape to be discussed, describe the shape in words, a signature, or a table.

Open questions that would normally go to a stakeholder get written down alongside the assumption
chosen, in the notes. They are never resolved silently.

### Phase 2 — Pre-flight completeness gate

**Before emitting anything**, enumerate what the agreed design actually covers, and check it
against what working code would require.

If producing functioning code would require any element that was not agreed — an error path, a
dependency, a helper, a config value, a decision about behaviour nobody made — **stop and raise
it as a question**. Do not fill it in. Do not pick a sensible default. Do not add it because the
code is meaningless without it.

An incomplete plan is a defect in the planning, not a licence to improvise. Finding the gap here,
before generation, is the cheap outcome and the desired one.

### Phase 3 — Emission

Once the gate passes, the code is produced **in chat**, in a fenced block. Not written to a file.

It contains **exactly what was agreed and nothing else**:

- no convenience helpers nobody asked for,
- no defensive branches that were not specified,
- no logging, no configuration hooks, no extension points added "for later",
- no comments explaining the code — the design conversation is the explanation,
- no adjacent files produced because they seemed to be implied.

If it feels incomplete, that is information about the plan, not a reason to extend the artifact.

### Phase 4 — Abort-and-withhold gate

If a gap, contradiction, or missing decision surfaces **during** generation:

1. **Discard the partial artifact. Do not show it.** Not in full, not in part, not "for context",
   not as an illustration of where the problem appeared. Showing it defeats the protocol.
2. Report only: what was missing, at which point in the design it should have been decided, and
   the options.
3. The operator then either amends the design, or rules the gap out of scope and instructs that
   it be ignored.
4. Generation restarts from the top only after that is settled.

Reporting the error is always the correct outcome. Producing a working artifact by quietly
resolving the gap is a failure, even when the resolution was obvious and correct.

### Phase 5 — Transcription to file

An accepted artifact is written to a file only when the operator explicitly instructs it and names
the path. That write is **transcription**: the accepted text, verbatim.

It is not an occasion to rename anything, reorder anything, add an import, fix a typo, improve a
type, or apply anything learned since. If the artifact needs changing, that is a new pass through
the protocol.

_(Assumption made explicit: without this phase nothing would ever run and the harness could not
produce results. If the operator wants transcription gone entirely, say so and it goes.)_

### Enforcement

Write and Edit against implementation paths are blocked at the harness level, not left to
discipline — see `.claude/settings.json`. `docs/`, `notes/`, and `README.md` remain writable
because they are the deliverable that ranks first.

### Why this exists

The protocol is not overhead sitting on top of the work. The plan-then-artifact trail _is_ the
"how you worked" deliverable, and it is the one the exercise ranks above the code.

---

## Interaction rules

- **Never modify files, run commands, or execute anything without an explicit, unambiguous
  instruction.** Discussing a plan, agreeing with an idea, or saying "ok" is not authorization.
  If it is not 100% certain that the instruction was given — ask.
- **Take everything the operator says literally** — statements, questions, and commands alike.
- **There are no rhetorical questions.** Every question is a real question and wants a direct
  answer. A question is not a hint, not a suggestion, and not an invitation to implement.
  "Why is X done this way?" means explain it. "Couldn't we do Y?" means answer whether we could.
- **Push back.** Debate, challenge, present trade-offs and alternatives. Agreeing with everything
  is a failure mode, not politeness.
- Do not restate what was just established, re-litigate a settled decision, or enumerate options
  that will not be pursued.

## Notes and decision records

- `notes/` — the working record. Session notes, open questions with the assumption taken, dead
  ends and why they were abandoned. Rough is fine; this is meant to read as work, not as a
  polished write-up.
- `docs/adr/NNNN-<slug>.md` — one record per architectural decision: context, options considered,
  decision, consequences. Written when the decision is made, not reconstructed afterwards.
- Cutting something for time is worth a note explaining why. That note is more useful to the
  reader than the thing would have been.

## Git

- Branch: `kacper/<type>/<name-kebab>`
- Conventional Commits: `type(scope): description`
- Atomic commits — one logical change each. Never consolidate a commit plan into fewer commits;
  the granularity is part of the reasoning trail.
- Never commit without an explicit instruction to commit.
- `git push --force-with-lease` on feature branches only.

## Subagents

- Fire-and-forget: one prompt in, one result out, then gone. No follow-up, no resume.
  Every prompt must be self-contained.
- Never design a workflow that requires agents to talk to each other. The main session mediates
  every exchange, and every hop costs tokens and loses information. Subagents are for parallel,
  independent, read-only work.
- Subagents are bound by the Code Production Protocol exactly as the main session is. A subagent
  may read, search, analyse, and run commands. It may not author implementation files.
- Context they receive: this file and any rules without `paths` frontmatter load at session start;
  path-gated rules load when a matching file is read. Memory contents do not load — pass values
  explicitly in the prompt.

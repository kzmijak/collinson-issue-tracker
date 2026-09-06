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

## How we work

Agents implement. You are not carrying anyone by the hand, and nothing here gates writing code
behind a hand-approval step. Confidence in what gets built comes from the harness measuring it, not
from supervision — hand-gating the agent would contradict the premise of the project itself.

Three things still hold, because they are cheap and they are what the deliverable is made of:

**Plan before non-trivial work.** For anything beyond a small, local change, say what you are about
to build and why before building it. Not for approval — for the record. A one-paragraph note in
`notes/` costs nothing and is ranked above the code by the people reading this repository.

**Surface gaps, do not invent through them.** If the design is underspecified and finishing would
mean inventing a behaviour nobody decided — an error path, a threshold, a policy default — say so
and pick a default explicitly, in writing. Silently choosing is the failure; choosing and recording
the choice is fine. The brief asks for exactly this: the open question, and the assumption you went
with.

**Keep the trail.** Notes in `notes/`, decisions in `docs/adr/`, atomic commits. This is deliverable
#1 and it is worth more than the code it describes. Write the note when the thinking happens, not
reconstructed afterwards.

Scope discipline is the one hard rule: build what was agreed. Adding an unrequested helper,
extension point, or config hook is scope, and this exercise warns against volume four separate
times. If something genuinely needs adding, add it and say you did.

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
  independent work.
- The dev and tester agents write files. Reviewer, qa and architect do not — a reviewer that writes
  the fix stops being a second pair of eyes.
- Context they receive: this file and any rules without `paths` frontmatter load at session start;
  path-gated rules load when a matching file is read. Memory contents do not load — pass values
  explicitly in the prompt.

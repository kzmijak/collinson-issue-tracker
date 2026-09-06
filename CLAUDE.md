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

---

## How we work — spec-driven

Agents implement. Nothing here gates writing code behind a hand-approval step: confidence in what
gets built comes from the harness measuring it, not from supervision. Hand-gating the agent would
contradict the premise of the project itself.

What replaces supervision is a **written specification per unit of work**, committed before the code
that satisfies it. That is the method, and it is not overhead — the sequence of specs and the
implementations that follow them _is_ the record this exercise asks for. You do not produce a
reasoning trail as a side task; it falls out of working this way.

### The loop

1. **Write the spec** — `specs/NNN-<slug>.md`, one work-order step from `PLAN.md`. See the template
   in `specs/README.md`.
2. **Commit the spec on its own** — `spec(scope): ...`. Before any implementation. This ordering is
   the evidence; a spec committed alongside or after its code reads as reconstruction, and git
   timestamps make that visible.
3. **Implement it** — `feat(scope): ...`, referencing the spec.
4. **When the spec turns out wrong, amend it in a separate commit, with the reason.** This is the
   most valuable part of the trail and the easiest to skip. "Spec assumed X; the data has Y; revised
   to Z" is a real decision under a real constraint. A spec that was never amended looks like a spec
   written afterwards.

### Rules of the method

**Spec just-in-time, one step ahead.** Do not write all eight specs up front. The failure mode of
spec-driven work in a time-boxed exercise is that the ceremony becomes the work — beautiful specs
for everything, implementations for a third of it. Spec step N, build it, then spec step N+1 with
what you learned building N.

**A spec must be falsifiable.** Specific enough that two people could read it and disagree about
whether the implementation satisfies it. This is the same standard the project sets for adapter
policies, applied to itself: if a spec cannot be executed unambiguously, it fails its own test.

**Surface gaps, do not invent through them.** If finishing would mean inventing a behaviour nobody
decided — an error path, a threshold, a policy default — pick one and _write down that you picked
it_, in the spec. Silently choosing is the failure; choosing and recording is fine. The brief asks
for exactly this: the open question, and the assumption you went with.

**Scope discipline.** Build what the spec says. An unrequested helper, extension point or config
hook is scope, and this exercise warns against volume four separate times. If something genuinely
needs adding, add it and say you did — in the spec, as an amendment.

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

- `specs/NNN-<slug>.md` — the executable layer. One per work-order step, committed before its
  implementation. This is where "what are we building and how do we know it works" lives.
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
- `spec(scope):` for a specification, `feat(scope):` / `fix(scope):` for the code satisfying it,
  `spec(scope): revise ...` for an amendment. Spec commits land before their implementations.
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

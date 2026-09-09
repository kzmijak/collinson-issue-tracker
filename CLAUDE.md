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

1. **The operator writes `Read this first`** — one sentence plus four rows: `Check`, `Proves`,
   `Numbers`, `Not this`. This is the record of what was decided and the only part a reader must
   read. An agent never writes it; agents may only read and expand it. See the template in
   `specs/999-spec-template.md`.
2. **An agent expands the rest** — `Done when`, the examples, the acceptance check, the decisions.
   That is how the decision gets carried out, not what was decided. Where expanding it would mean
   inventing a threshold or a case, the question goes back to the operator instead.
3. **Commit the spec on its own** — `spec(scope): ...`, once, when it is finished. Before any
   implementation. This ordering is the evidence; a spec committed alongside or after its code reads
   as reconstruction, and git timestamps make that visible. The rounds of questions and answers that
   preceded it are not commits.
4. **Implement it** — `feat(scope): ...`, referencing the spec. Split by logical change, not by
   file. The convergence loop — check fails, agent fixes, check runs again — produces **no commits**;
   an intermediate state is not a logical change and records only that something did not work yet.
5. **When the spec turns out wrong, amend it in a separate commit, with the reason**, then fix the
   code in another. This is the most valuable part of the trail and the easiest to skip. "Spec
   assumed X; the data has Y; revised to Z" is a real decision under a real constraint. A spec that
   was never amended looks like a spec written afterwards.

The steady rhythm is two commits per spec, `spec(...)` then `feat(...)`, plus a `spec(...): revise`
and a `fix(...)` each time reality contradicts it.

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
- **Commits go through the `git` agent.** A `PreToolUse` hook blocks `git add` and `git commit` for
  everyone else, including the main session. Prepare the working tree, then delegate with a complete
  commit plan; the agent may split it further but never consolidates it.
- `git push --force-with-lease` on feature branches only.

## Subagents

- Fire-and-forget: one prompt in, one result out, then gone. No follow-up, no resume.
  Every prompt must be self-contained.
- Never design a workflow that requires agents to talk to each other. The main session mediates
  every exchange, and every hop costs tokens and loses information. Subagents are for parallel,
  independent work.
- The dev and tester agents write files. Reviewer, qa, architect and spec-reviewer do not — a
  reviewer that writes the fix stops being a second pair of eyes. The `git` agent writes nothing but
  commits.
- `spec-reviewer` judges a spec on falsifiability, traceability and scope. It cannot judge
  traceability on its own, because it never sees the conversation — pass the record of what was
  agreed in its prompt, or it will say so rather than guess.
- Context they receive: this file and any rules without `paths` frontmatter load at session start;
  path-gated rules load when a matching file is read. Memory contents do not load — pass values
  explicitly in the prompt.

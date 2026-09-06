# collinson-issue-tracker

An LLM-powered GitHub issue triage service, and — the part that matters — an evaluation harness
for it.

Written for the AI Platform Engineer take-home exercise.

---

## How this was built, and with what

This is a time-boxed recruitment exercise, and I had a limited amount of time to give it. Two
consequences worth stating plainly rather than leaving for you to infer:

**I leaned on AI heavily for the implementation.** That is not an apology — for this role it is
arguably the thing worth demonstrating — but it does change what the code proves. Generated code is
evidence of a working process, not of craftsmanship.

The tempting response is to put a leash on it: gate every file behind a design conversation, require
manual sign-off before anything is written. I tried that, and then removed it, because it
contradicts the premise of the project. This whole exercise is an argument that you establish
confidence in an LLM system by **measuring its output**, not by supervising its every step. Applying
that to the service while hand-holding the agent that builds it would be incoherent — and it would
put me, the slowest component, in the critical path of every change.

What replaces the leash is **spec-driven development**. Each unit of work gets a written
specification in `specs/` — goal, done-when, an acceptance check that can be run, the decisions
already made, the assumptions taken, and what it must explicitly not do. The spec is committed
first, on its own; the implementation follows in a later commit; and when the spec turns out to be
wrong, it is amended in its own commit with the reason.

That ordering is deliberate, and it is why this method suits the exercise rather than sitting beside
it. The brief asks to follow the reasoning and see the decisions, not to read a polished write-up.
A sequence of specs, implementations, and visible amendments _is_ that record, with timestamps I did
not have to curate. The amendments are the honest part: a spec that was never revised is a spec
written after the fact.

So the layers are: `PLAN.md` is the concept — architecture, what gets measured, what was cut, and
why. `specs/` is the executable layer. `docs/adr/` holds the decisions that outlive a single step.
`notes/` is the working record. The trail, not the diff, is what I would want read.

**I bootstrapped it from my own framework.** The LLM port, the metering, the append-only chronicle
and the agent suite are lifted from a personal project of mine and adapted. That project already
had working answers to most of the problems this exercise poses — budget-metered LLM runs,
structured output from Zod schemas, replayable event logs, policy-driven multi-agent workflows —
and rebuilding them from scratch to look more impressive would have been dishonest and slower.

### What is and is not visible in this repository's history

The bootstrap — the migration itself and the planning that shaped it — happened **before** this
repository's first commit, inside that private personal project. What was ported, why, and what was
deliberately left behind is summarised in `PLAN.md`; the decisions that governed it are in
`docs/adr/`.

Everything from the bootstrap onward is trackable here: commits, notes in `notes/`, and decision
records. Anything earlier remains part of the personal project and is not public.

---

## The idea

**ArgoCD, but for issue handling.**

ArgoCD does not "deploy things". It holds a declarative desired state in git, runs a reconciliation
loop against observed state, and applies changes under a sync policy that is either automatic or
gated on a human. The interesting part is not the applying — it is the loop, the policy, and the
gate.

The same decomposition works for issue triage. Six primitives:

| #   | Primitive           | Job                                                                                                                       |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Meter**           | Accumulates effective tokens across a run, exposes `shouldStop()`, aborts on breach. Wraps every stage, belongs to none.  |
| 2   | **State**           | Append-only decision log plus a keyed last-applied record. "What did we decide about #47, at which content hash."         |
| 3   | **Observer**        | Polls the issues API on a clock, diffs against last-applied, emits work.                                                  |
| 4   | **Policy resolver** | Loads versioned policy documents from the _target_ repo and selects which apply.                                          |
| 5   | **Classifier**      | Issue + resolved policies → a structured decision: category, urgency, needs-human, policy verdict, estimated cost to fix. |
| 6   | **Gate**            | auto \| manual, with a pluggable channel. Decides whether the proposed action proceeds.                                   |

### The split that is the actual point

**Framework** (`src/framework/`) — the six primitives. Repo-agnostic, no domain knowledge, no policy
content.

**Adapter** (`adapters/<repo>/`) — policy documents, category taxonomy, urgency bands, budget
ceilings, gate configuration. One directory of markdown plus a config file.

The framework is commodity scaffolding and is largely generated. **The adapter is the assessment.**
Which categories matter for a given repository, which policies apply, what a fix is allowed to cost,
when a human gets called — those are decisions, and decisions are what the exercise says it wants to
see. The harness measures the adapter; the framework is only the substrate it runs on.

That split also makes the tool recursive: it can run against any repository, including this one. A
second, minimal adapter targets this repo — enough to demonstrate that the seam is real, not enough
to pretend a fifteen-issue repository is a dataset.

---

## What the harness measures

One thing, deliberately: **decision quality per effective token, across adapter configurations.**

Not "which model is cheapest" — that comparison is trivial and everyone has it. Because the pipeline
is real, the configurations are meaningful: stages on or off, policy on or off, model and reasoning
effort per stage, single-pass versus multi-agent classifier. The question the harness answers is the
one the brief poses literally — did this change to the adapter make it better, and what did the
improvement cost.

Metrics are chosen per field rather than uniformly, because a single accuracy number would hide
exactly the cases the policy layer exists for:

- **category** — per-class precision and recall. The interesting classes (spam, off-topic, policy
  violation) are rare, and aggregate accuracy on an imbalanced set is the classic untrustworthy eval.
- **urgency** — ordinal, so mean absolute error. One band off is not three bands off.
- **needs_human** — asymmetric. A missed escalation costs more than an unnecessary one, so a
  cost-weighted score with the weight stated as an assumption.
- **estimated cost to fix** — this is a _prediction_, so it is scored against actual spend. Estimation
  error is a headline result, not a diagnostic.

That last one is the measurement I care most about. It is the service reasoning about its own
economics, and it is the quality-versus-cost trade-off the brief asks for, made concrete.

### The test set

**The policy document and the labelling rubric are the same file.** Adapter policies have to be
falsifiable — specific enough that two people can label an issue against them and disagree. Once
they are that specific, they _are_ the rubric. Not a rubric written afterwards to make evaluation
possible; the production policy, doing double duty.

Construction: stratified sample from a public repository with real issue volume, rare classes
deliberately over-represented, results reported per class; hand-labelled against the written rubric;
a measured agreement check between the hand labels and an LLM judge; a held-out slice never used
while iterating. GitHub's own labels are not triage decisions and are too noisy for ground truth.

**The circularity risk is named up front:** policy sits in the prompt, policy is the rubric, and the
model is scored against the rubric — so a system can score well by restating policy rather than
applying it. The guards are labelling independently of model output, loading the set with borderline
cases that require interpretation rather than lookup, and holding a slice back.

---

## Status

Bootstrapped. The LLM port, metering primitives, gate and project scaffolding are in place;
typecheck, lint and format are green. **There are no tests yet**, so treat `pnpm check` as a
syntax-and-style gate rather than evidence of behaviour. The service, the harness and the dataset
are the work in progress.

Planned order, and the reasoning for it, is in `PLAN.md`; each step becomes a spec in `specs/` as it
is reached. The first is deliberately unglamorous: verify that token accounting is correct. Every
number this project reports comes out of the meter, so an unverified meter would silently invalidate
the adapter work — which is the actual deliverable.

`PLAN.md` describes a system that sounds deployable, so to be unambiguous about what this repository
will and will not contain: there is **no Docker image or hosted runtime** (the deliverable is a CLI,
which is what the brief asks for), **no MCP servers**, and **no autonomous fix-and-publish** — the
delivery stage emits a plan, never a pull request. Making it a running service is a different and
materially larger build, and it would compete with the harness for the time this exercise says to
spend on the harness.

Sections to be completed before submission: **how to run it**, and **what the eval showed**. They are
empty because the runs have not happened, not as an oversight.

---

## Assumptions

Open questions I would normally have taken to a stakeholder, with the choice I made. Full reasoning
in `PLAN.md`.

1. **TypeScript, not Python** — the toolset I bootstrapped from is TypeScript. Both were permitted.
2. **The primary adapter targets a large public repository, not this one** — the eval set has to come
   from a repo the adapter actually governs, and this one has too few issues. Letting agents act on
   the submission repo would also pollute its history, which is part of what is being read.
3. **The multi-agent classifier is a measured challenger, not the shipped design** — build the
   single-pass version as the baseline and let the harness decide whether the elaborate one earns its
   cost. "We built it and measured that it did not pay for itself" is a better answer than building
   it unexamined.
4. **A missed escalation costs 5× an unnecessary one** — the `needs_human` metric depends on this
   weight and no stakeholder was available to set it. Stated so it can be argued with.
5. **Effective tokens internally, dollars at the boundary** — a model-agnostic unit is the point of a
   swappable LLM port; dollars are what a reader actually evaluates.

## Scope deliberately cut

Webhooks (the observer polls, as ArgoCD does — it removes the entire inbound-HTTP surface),
autonomous PR creation, a hosted deployment, custom MCP servers, an appeals workflow. The GitHub
delivery surface is one port with two implementations: a fake that records what would have been
posted, and a real one that posts — so the approval flow exists as a tested state machine without
any webhook infrastructure behind it.

The delivery stage produces a **fix plan and a cost estimate, not executed code**. Nothing in the
harness scores a merged pull request, and a plan is a _comparable_ artifact in a way a merge is not:
two configurations produce two plans for the same issue, and those can be scored against each other
and against actual spend. See ADR-0002.

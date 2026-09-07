# Plan — collinson-issue-tracker

> **This is a concept document.** It describes what the system is, what gets measured, what was cut,
> and which assumptions were taken. It is deliberately not executable and should not be read as a
> build instruction — "implement PLAN.md" would leave an implementer inventing dozens of decisions
> this document does not make.
>
> The executable layer lives in `specs/`: one specification per work-order step below, each with
> acceptance checks, committed before the code that satisfies it. See `specs/README.md` for the
> template and `CLAUDE.md` for the method.

## What this is

ArgoCD for issue handling. A framework of generic primitives, plus a repo-specific adapter that
composes them into an actual triage policy. The framework is commodity scaffolding. **The adapter
is the assessment.**

That split follows the brief directly: _"the decisions you make about scope and approach are part
of what we want to see"_ and _"we are interested in the choice itself."_ Framework code is
machinery and can be generated. Which categories matter, which policies apply, what the budget is,
where a human gets called — those are decisions, and they are what gets measured.

## Architecture

Six primitives. Each one exists in the framework as a seam, and is configured by the adapter.

| #   | Primitive           | Job                                                                                                                             |
| --- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Meter**           | Accumulates effective tokens across a run, exposes `shouldStop()`, aborts on breach. Wraps every stage, belongs to none.        |
| 2   | **State**           | Append-only decision log plus a keyed last-applied record. Answers "what did we decide about issue #47, at which content hash." |
| 3   | **Observer**        | Polls the issues API on a clock, diffs against last-applied, emits work.                                                        |
| 4   | **Policy resolver** | Loads versioned policy documents from the _target_ repo and selects which apply to this issue.                                  |
| 5   | **Classifier**      | Issue + resolved policies → structured decision: category, urgency, needs_human, policy verdict, estimated cost.                |
| 6   | **Gate**            | auto \| manual, with a pluggable channel. Decides whether the proposed action proceeds.                                         |

Delivery is the seventh stage but not a seventh primitive — it is a classifier variant whose
output is a **fix plan plus cost estimate**, not executed code. Two reasons: nothing in the harness
scores a merged PR, and a plan is comparable in a way a merge is not — two configurations produce
two plans for the same issue, scoreable against each other and against actual spend. See ADR-0002.

## Framework vs adapter

**Framework** (`src/framework/`) — the six primitives, the LLM port, the schema→prompt bridge, the
harness runner. Repo-agnostic, no domain knowledge, no policy content.

**Adapter** (`adapters/<repo>/`) — policy documents, category taxonomy, urgency bands, budget
ceilings, gate configuration, the repo link. This is the elaborate part and the part under test.

The seam is deliberately narrow: an adapter is a directory of markdown policies plus one config
file. That constraint is what makes the framework claim credible.

## What the harness measures

**One thing: decision quality per effective token, across adapter configurations.**

Not "which model is cheapest." The configurations are meaningful because the pipeline is real —
stages on/off, policies on/off, model and effort per stage, single-pass vs multi-agent classifier.
The harness answers the brief's question literally: did this change to the adapter make it better,
and what did the improvement cost.

Metrics, chosen per field rather than uniformly:

- **category** — per-class precision/recall. Never aggregate accuracy; the interesting classes
  (spam, off-topic, policy violation) are rare, and an aggregate number hides exactly the cases the
  policy layer exists for.
- **urgency** — ordinal, so mean absolute error. Being one band off is not the same as three.
- **needs_human** — asymmetric. A missed escalation costs far more than an unnecessary one, so a
  cost-weighted score, with the weight stated as an assumption.
- **estimated_et** — this is a _prediction_, so it gets scored against actual spend on the cases
  that were executed. Estimation error is a first-class result, not a diagnostic.

The estimate-vs-actual measurement is the most distinctive thing here. It is the service reasoning
about its own economics, and it is directly the quality-versus-cost trade-off the brief asks for.

## The test set

**The policy document and the labelling rubric are the same file.** Adapter policies have to be
falsifiable — specific enough that two people can label an issue against them and disagree. Once
they are that specific, they are the rubric. Not a rubric invented to make evaluation possible;
the production policy, doing double duty.

Construction:

- Stratified sample from a public repo with real issue volume. The rare classes get deliberately
  over-represented, and results are reported per class.
- Hand-labelled against the written rubric, target ~60 issues. GitHub labels are not triage
  decisions and are too noisy to use as ground truth.
- A measured agreement check between the hand labels and an LLM judge, reported as a number. If
  agreement is poor, the rubric is ambiguous and that is a finding worth reporting.
- A held-out slice, never used while iterating.

**Circularity is the trap.** Policy sits in the prompt, policy is the rubric, the model is scored
against the rubric — so a system can score well by restating policy rather than applying it.
Guards: label independently of model output, load the set with borderline cases that need
interpretation rather than lookup, hold out a slice. This gets named in the README before a
reviewer names it.

## Scope

**In:** the six primitives, one elaborate adapter, one minimal second adapter (this repo — the
uroboros, as a portability demo), the harness, the eval set, the reasoning trail.

**Out, deliberately:** webhooks (the observer polls — ArgoCD polls too, and it removes the entire
inbound-HTTP surface), autonomous PR creation, a live-hosted deployment, multiple custom MCP
servers, an appeals workflow (it collapses into `needs_human`).

**Stubbed, not built:** the GitHub delivery surface is one port with two implementations —
`FakeGitHub` records what would have been posted, `RealGitHub` posts. The 👍 approval flow then
exists as a tested state machine, demonstrable without any webhook infrastructure. Run it once
against a live issue with `RealGitHub` and put the transcript in `notes/`.

## Open questions and the assumptions taken

Per the brief: _"If you have an open question that you would normally ask a stakeholder, write down
the question and the assumption you went with."_

1. **Which repo does the primary adapter target?** _Assumption:_ a large public repository with
   several hundred open issues and an active maintainer culture, chosen for issue diversity rather
   than familiarity. The uroboros adapter targets this repo as the portability demo — it has too
   few issues to be a dataset, and letting agents act on the submission repo would pollute the git
   history, which is deliverable #1.
2. **Is the multi-agent classifier the shipped design or a measured challenger?** _Assumption:_
   challenger. Build the single-pass version as the baseline, the multi-agent version as a variant,
   and let the harness answer whether it is worth its cost. "We built the sophisticated version and
   measured that it did not pay for itself on six of eight classes" is a better submission than
   building it unexamined.
3. **What is the cost of a missed escalation relative to an unnecessary one?** _Assumption:_ 5:1,
   stated in the README and adjustable, because the metric depends on it and no stakeholder is
   available to set it.
4. **Effective tokens or dollars as the budget unit?** _Assumption:_ both, at different layers. ET
   internally — model-agnostic, which is the point of a framework meant to swap providers — and
   dollars at the reporting boundary, because that is what a reviewer reads.

## Work order

Each step below becomes one specification in `specs/`, written just before it is built — not all at
once. The spec carries what this document deliberately does not: acceptance checks, file-level
detail, and the decisions that were still open when this was written.

| #   | Step                                                                                     | Notes                                                                                                                                        |
| --- | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | GitHub read path + container image                                                       | The runner has to be runnable by a reviewer before anything it does is worth measuring. Spends no tokens, so it does not wait on the meter.  |
| 1   | Meter, state, classifier primitives + `AnthropicLlm` + cost smoke test                   | Nothing downstream is trustworthy until token accounting is verified. Independent of every open question below, so it can start immediately. |
| 2   | ADR on structured output: SDK-native `output_config.format` vs the ported `schemaToSpec` | Deciding _not_ to port a home-grown serializer is a result worth recording.                                                                  |
| 3   | The primary adapter's policy documents                                                   | These are the labelling rubric, so they precede the dataset. Blocked on the target-repo question.                                            |
| 4   | Dataset construction + the agreement check                                               | Blocked on who labels. An LLM-labelled set scored by an LLM is a much weaker claim and must be disclosed, not discovered.                    |
| 5   | The harness: fixtures → pipeline → per-field metrics → cost                              | One measurement, reported well.                                                                                                              |
| 6   | Observer, policy resolver, gate primitives + the uroboros adapter                        | Observer promoted — it follows step 1. The rest of the row keeps its position. See the amendment.                                            |
| 7   | Configuration sweep → cost/quality frontier table                                        | Second to cut.                                                                                                                               |
| 8   | README completion: how to run it, what the evaluation showed                             |                                                                                                                                              |

Step 7 is now the only remaining candidate to drop; the observer has been promoted out of that list.
See the amendment. A note explaining a cut is worth more to the reader than a rushed version of the
thing cut.

### What this plan does not deliver

Stated plainly because the architecture section above describes a system that sounds deployable:

- **No production build.** There is a container image, but it installs dependencies and runs the
  sources through `tsx`. No compile step, no `dist`. It is a reproducibility surface, not a shipping
  artifact.
- **No hosted deployment.** The container runs on the reviewer's machine and on mine. Nothing is
  published to a public address, and no reviewer credential is required to run it.
- **No MCP servers.** The GitHub surface is one port with a fake and a real implementation.
- **No autonomous fix-and-publish.** The delivery stage emits a plan, never a pull request. See
  ADR-0002.

This section originally also ruled out the container and the running observer. It no longer does;
the amendment below records what changed the decision and what was cut to pay for it.

---

## Amendments

Appended as they happen, newest last. Each says what changed and what forced the change.

### _2026-09-06_ — the container and a live observer are in scope; the configuration sweep is cut

This plan stated "No Docker image and no runtime", and argued that a demonstrable running service
was a different plan that would compete with the harness for time.

That argument was about **deployment for its own sake**, and against that it still holds. The reason
given is a different one: a reviewer opening this repository should be able to run the thing, and
`docker run` is a materially lower barrier than "install pnpm 10.20 and Node 22, set environment
variables, then invoke `tsx`". A container in that role _serves_ the harness — it is how the harness
gets run reproducibly by someone who is not me — rather than competing with it. On that reading the
original bullet was answering a question nobody had asked.

The decision extends to a live observer polling the target repository, so that at submission the
runner is actually running rather than merely runnable.

**What it costs is not yet decided.** The observer was step 6, labelled "first to cut". Promoting it
means something else eventually pays, and step 7 is the remaining candidate. That cut is not
declared here: the time budget is not yet known, and an amendment should record decisions, not
forecasts. Noted so the debt is visible rather than silent.

**A consequence worth stating.** An unattended polling loop spends tokens unattended. The meter
therefore stops being purely an instrument of measurement and becomes a safety device, with a
ceiling that has to survive a process restart. That strengthens step 1's position in the queue
rather than weakening it, and it adds a requirement step 1 did not previously carry.

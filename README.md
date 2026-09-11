# collinson-issue-tracker

My submission for the AI Platform Engineer take-home exercise (`docs/assessment.md`). The brief asks
for a small LLM service that triages GitHub issues and, more importantly, an evaluation harness for it.

This repository holds two things:

1. **The Issues Tracker.** It polls GitHub, classifies issues and comments on them, and it's measured
   by a harness. This is the assessment.
2. **An SDD framework.** It's a toolset for spec-driven development with agents, and I'm building it
   for my own use. The assessment is where it gets proven: every line of tracker code is meant to come
   out of a spec run through the framework.

## Start with `CONCEPT.md`

`CONCEPT.md` is the source of truth, and it's written entirely by hand. It holds the roadmap, what
each stage builds, what the harness measures, how the framework works, and the identity of every
agent.

Every prompt an agent sees is cut from it word for word:

- `.ai/context.md` is shared by all agents
- `.ai/identities/*.md` holds one identity per agent
- `CLAUDE.md` imports both for the orchestrator

The goal is that no prompt text is written by an AI, apart from specs, whose generated half is
meant to be. That isn't true yet. These were written by an AI and are waiting to be rewritten:

- the field descriptions in the output contracts (`src/sdd-framework/spec/schemas/`)
- three one-line identities in the CLIs
- `.claude/agents/git.md`, which `pnpm commit` reads

## How the work is done

A spec works like a Terraform file: it describes the state the world should be in.

1. I write the **What I want** section of `specs/NNN-<slug>/spec.md`. I only ever append to it, never
   edit what's there.
2. `pnpm enrich NNN` has an agent expand it into a detailed spec. It also writes `accs.bash`, the
   acceptance criteria check script (ACCS), which tests the running system from the outside.
3. `pnpm verify NNN` has a second agent check that expansion against my section.
   It sets the status to `approved` or `rejected`.
4. `pnpm apply NNN` has an implementer agent write code until the ACCS passes.
5. `pnpm commit` plans the commits, asks for approval, and makes them.

`enrich`, `verify` and `apply` write a report into `specs/NNN-<slug>/metrics/`. None of them
repeats work that doesn't need doing:

- `enrich` skips if my section hasn't changed.
- `verify` reuses its last verdict while the spec is unchanged.
- `apply` does nothing if the ACCS already passes.
- `verify` and `apply` refuse a spec whose operator section changed after it was enriched.

The ACCS returns `0` when the world matches the spec, `1` when it doesn't, and `2` when it couldn't
decide. On `2`, a human looks at it.

## How to run it

Requirements: Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env    # set CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`
pnpm check              # typecheck, lint, format, unit tests
```

| Command                        | What it does                             | Budget              |
| ------------------------------ | ---------------------------------------- | ------------------- |
| `pnpm enrich <spec> [--force]` | expand my section into a spec and ACCS   | < 200k ET, ~5 min   |
| `pnpm enrich:accs <spec>`      | rewrite only the ACCS, using the verdict | —                   |
| `pnpm verify <spec> [--force]` | review the expansion                     | < 120k ET, ~3 min   |
| `pnpm apply <spec>`            | implement until the ACCS passes          | < 900k ET, ≤ 30 min |
| `pnpm commit`                  | plan and make the commits                | < 50k ET, ~3 min    |
| `pnpm test [spec]`             | unit tests, or one spec's ACCS           | —                   |

ET means effective tokens: input, output and cache tokens weighted by price, then by model.
It's the cost unit the whole project reports in.

The tracker itself has no run command yet. The first stage adds one.

## Status — 2026-09-11

The framework works. The assessment was restarted from zero today, so the tracker, the fake GitHub
and the harness don't exist yet. `PLAN.md` tracks the stages and records how the first plan was
replaced.

## What the evaluation showed

Nothing yet. The harness comes in the Beta stage.

It will compare LLM configurations (model, effort, identity) on a hand-labelled sheet of real issues.
It reports quality next to cost and time. The goal isn't to find the best model, since that will
most likely be the latest frontier model. The goal is the best value for money on this one task.

A configuration that follows a prompt injection is disqualified, however well it scores otherwise.

## Assumptions

Open questions I'd normally take to a stakeholder, with the answer I went with.

1. **TypeScript, not Python.** The framework I bootstrapped from is TypeScript. Both were allowed.
2. **A fake GitHub comes before the real one.** It gives full control over the data and its timing,
   including issues that arrive while the tracker runs, so early stages can be checked without
   network or tokens.
3. **The harness arrives late on purpose.** The test set is labelled by hand from issues the tracker
   has actually seen, so there is nothing to label until the tracker runs against real GitHub.
4. **Cost is measured in effective tokens and time.** Both are reported next to quality, because the
   brief asks to see the accuracy-versus-price trade-off.
5. **Speed over polish.** This is a time-boxed proof of concept, and its error tolerance is set high
   at early stages. It will never be production-ready. It is meant to be deployable.

## How AI was used

- **Framework code:** mostly AI-written. I set the direction and the design, and the concept states
  this openly.
- **Tracker code:** will be written by the framework's agents, from specs.
- **Prompts:** written by me, in `CONCEPT.md`, apart from the exceptions listed above.

The LLM port and the schema-to-prompt serializer were ported from a personal project of mine.

The record of how the work went is the commit history, the specs and their amendments, `docs/adr/`,
and the notes in `docs/`.

# collinson-issue-tracker

My submission for the AI Platform Engineer take-home exercise (`docs/assessment.md`). The brief asks
for a small LLM service that triages GitHub issues and, more importantly, an evaluation harness for it.

This repository holds two things:

1. **The Issues Tracker.** It polls GitHub, classifies issues and comments on them, and it's measured
   by a harness. This is the assessment.
2. **An SDD framework.** It's a toolset for spec-driven development with agents, and I'm building it
   for my own use. The assessment is where it gets proven: every line of tracker code is meant to come
   out of a spec run through the framework.

# DOCUMENT META - READ ME

_Yes, read me. No part of this document was written using AI_

!!! This is a noAI scratchpad. Sections of this article are spread across the AI toolsets (system prompt, rules, hooks, identities) as-is, without AI adding, removing or altering any paragraphs.

I firmly believe that all the prompts have to be written by hand each time to maintain complete control over agentic behavior.

The exceptions from this rule are the specfiles, which have human headers but their contents are enriched by AI - but even in that case, only the human-written part is immutable for the AI.

## Where the prompts live

Every prompt an agent sees is in `.ai/`, written by hand:

- `.ai/context.md` is shared by all agents: the roadmap, what each stage builds, what the harness
  measures, how the framework works
- `.ai/identities/*.md` holds one identity per agent
- `CLAUDE.md` imports both for the orchestrator

These started as a single document, `CONCEPT.md`, split into the files above word for word. Its
history is in git.

The goal is that no prompt text is written by an AI, apart from specs, whose generated half is
meant to be. That isn't true yet. These were written by an AI and are waiting to be rewritten:

- the field descriptions in the output contracts (`src/sdd-framework/spec/schemas/`)
- three one-line identities in the CLIs
- `.claude/agents/git.md`, which `pnpm commit` reads

## How the work is done

A spec works like a Terraform file: it describes the state the world should be in.

1. I write two files in `specs/NNN-<slug>/`. `spec.md` holds the **What I want** section: I only
   ever append to it, never edit what's there. `accs.md` says how to check that the world matches
   the spec — the method behind the acceptance criteria check script (ACCS). I edit it in place, and
   git keeps its history.
2. `pnpm enrich NNN` runs two agents. The enricher expands `spec.md` into a detailed spec and writes
   the contract in it: commands, variables, what the output looks like. The ACCS author then turns
   `accs.md` into `accs.bash`, the ACCS, honouring that contract. Both land in `output/`, and neither
   is written unless both succeed.
3. `pnpm verify NNN` has a third agent check the expansion against `spec.md` and the script against
   `accs.md` and the contract. It sets the status to `approved` or `rejected`, and on a rejection says
   what has to be redone: the spec (both regenerate) or only the ACCS (`pnpm enrich:accs` repairs it
   and leaves the approved contract alone). `pnpm verify NNN --loop <turns>` follows that advice
   until the verdict is `approved` or the turns run out.
4. `pnpm apply NNN` has an implementer agent write code until the ACCS passes.
5. `pnpm commit` plans the commits, asks for approval, and makes them.

Everything agents write sits in `specs/NNN-<slug>/output/`, reports in `output/metrics/`. None of
the commands repeats work that doesn't need doing:

- `enrich` skips if neither `spec.md` nor `accs.md` has changed.
- `verify` reuses its last verdict while the spec is unchanged.
- `apply` does nothing if the ACCS already passes.
- `verify` and `apply` refuse a spec whose `spec.md` or `accs.md` changed after it was enriched.

The ACCS exits `0` when the world matches the spec and `1` when it doesn't. There is no third
answer: before implementation nothing it checks exists yet, which is simply "doesn't match". A check
that hangs counts as `1` too.

## How to run it

Requirements: Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env    # set CLAUDE_CODE_OAUTH_TOKEN, from `claude setup-token`
pnpm check              # typecheck, lint, format, unit tests
```

| Command                        | What it does                             | Budget              |
| ------------------------------ | ---------------------------------------- | ------------------- |
| `pnpm enrich <spec> [--force]` | expand spec.md and accs.md into output/  | < 200k ET, ~5 min   |
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
- **Prompts:** written by me, in `.ai/`, apart from the exceptions listed above.

The LLM port and the schema-to-prompt serializer were ported from a personal project of mine.

The record of how the work went is the commit history, the specs and their amendments, `docs/adr/`,
and the notes in `docs/`.

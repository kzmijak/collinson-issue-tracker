# `pnpm apply` — the context contract, and the numbers nobody decided

2026-09-09.

## Why this command exists

Spec 001 was implemented by handing a `dev` subagent a prompt I wrote. That prompt carried four
things the spec did not: two decisions resolving a contradiction between the spec and
`.env.example`, one decision overruling the spec's own recommendation, and a decision the operator
had made in conversation that never got written down ("the first poll fires immediately").

The implementation was fine. The record was not. A prompt is not committed; the spec is. So the
spec alone would not reproduce that implementation, and the gap was invisible because my wording
had closed it.

`pnpm apply` exists to make that impossible. It is not a cheaper `dev`; it is a **narrower** one.

## The contract

An implementer is given exactly three things:

1. **The spec file, verbatim, whole** — both halves, the operator's prose and the generated part.
   Not an excerpt, not a summary, and no editorial choice about which half is "the requirement".
2. **Every other file in the spec's directory** — the acceptance check above all, because that is
   the definition of done and it has to be readable.
3. **The identity** (`.claude/agents/spec-implementer.md`) **and the knowledge base**
   (`knowledge/*.md`, empty for now).

`src/spec/ApplyPrompt.ts` adds nothing else about this project, and a test asserts it: the message
must not mention TypeScript, Vitest, pnpm, `src/spec/` or git. Those belong to the identity.

The split that falls out is worth stating plainly:

- **The spec carries requirements.** What to build, with literal values.
- **The identity carries conventions.** Where code goes, style, what is forbidden.
- **Anything in neither does not exist.** The implementation then has a visible hole instead of one
  papered over by a prompt nobody can read afterwards.

## The git guard does not reach here

`ClaudeCodeLlm` passes `settingSources: []`. That keeps `CLAUDE.md` and the rule files out, which
is deliberate — but it also keeps **hooks** out, so `.claude/hooks/guard-bash.mjs` does not protect
a query started by this tool. The `PreToolUse` guard covers the interactive session only.

Two replacements, neither of which is a hook:

- `disallowedTools` patterns in `src/cli/apply.ts` (`Bash(git commit:*)` and friends), plus a denial
  of `Task`, `WebFetch` and `WebSearch` — no sub-delegation, no input from outside the repo.
- The rule itself, spelled out in the identity, because a pattern list cannot anticipate every
  spelling of a git write.

## The numbers, which are picks

None of these came from the operator. Each is a threshold, and `.claude/rules/specs.md` says a
threshold is a value judgment wearing the costume of a parameter. They are recorded here so they can
be argued with.

| Pick                    | Value           | Why                                                                                                                                                               |
| ----------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model                   | `claude-opus-5` | The operator said apply would run on opus. A wrong implementation costs more than the price difference.                                                           |
| `taskBudget`            | 150,000 tokens  | Enrichment runs at 45,000 and writes one document. This writes a module and its tests and cannot have its tools taken away, so the budget is the only lever left. |
| `maxTurns`              | 60              | Reads, writes and check runs each cost a turn. The tool-less default of 4 exists only to continue a truncated answer, and would fail silently here.               |
| Rounds before giving up | 3               | Enough for "check fails, fix, passes" with one spare. `--rounds N` overrides it; this is the pick most likely to be wrong.                                        |
| Check timeout           | 300s            | Spec 001's own check takes ~10.5s. Anything twenty times that has hung.                                                                                           |

No `maxBudgetUsd`. A hard abort returns nothing usable, so it buys a cheaper failure rather than a
cheaper success — the same reasoning as `notes/enrich-cost-measurements.md`.

## The check is the plan step

`apply` runs the acceptance check **before** spending anything, and three outcomes end the run at
zero cost:

- the spec's status is not `accepted` → refused, because implementing an unverified spec is how a
  rejected decision reaches the code (`--force` overrides);
- the check already passes → nothing to do, the spec is converged;
- the check cannot run or hangs → reported as unable to judge, never handed to an implementer to
  "fix", because it has not said anything about the implementation.

This is `.claude/rules/specs.md` taken literally, and it carries that file's warning with it: a
check only sees what someone enumerated, so "nothing to do" means "nothing anyone wrote a case for".

## The check owns its process tree

`runCheck` starts the script detached and kills the whole process group afterwards, pass or fail.
Spec 001's check leaks otherwise: it runs `timeout 4s pnpm prototype-issues-reader`, and pnpm 10
does not forward `SIGTERM` down to the node process it spawned, so the reader survives every run as
an idle orphan. Verified by hand — three surviving processes after one run. The check is a generated
artefact and must not be edited to work around it, so the fix lives on the side that owns the
running.

## Length is a contract term, not a matter of taste

The first run's `summary` came back as a 25-line essay and its `blocked` as another; twelve picks
printed three lines each. The operator's verdict on reading it: "NIE CHCĘ TEGO WSZYSTKIEGO CZYTAĆ i
jest to w połowie niezrozumiałe."

Two fixes, because either alone leaks:

- **The contract now carries limits.** Three sentences of summary, three of `blocked`, one sentence
  per reason, twelve words per question — plus an explicit ban on restating the spec, listing what
  was ruled out, and narrating process. A field with no stated length gets an essay.
- **The report clips anyway.** `brief()` keeps the first sentences and no more, picks print as one
  line each with a count of the rest, and the check excerpt is 700 characters. A model asked for
  three sentences sometimes sends twenty, and the terminal is the wrong place to find that out.

The split that makes both safe: **the terminal gets the verdict and the next action; the metrics
record keeps every word.** Nothing is lost, it is just not in the way.

A new field earns its place here: `remedy`. In the first run the one thing the operator had to do —
`unset GITHUB_MOCK_FAIL_COUNT` — was buried twenty lines into a paragraph. It now has a field of its
own, one line, printed first under "Do this".

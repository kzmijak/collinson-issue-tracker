---
paths:
  - 'specs/**'
---

# Writing a Spec

`CLAUDE.md` carries the loop. This file carries the part that is not obvious from it, and that has
already been got wrong more than once.

## The operator writes prose; the tool writes structure

A spec has two halves, and the boundary is a marker in the file, not a convention.

**`What I want` belongs to the operator.** Dated entries, appended, **never edited once written** —
it is the record of what was decided and when. An agent may read it and expand it. An agent may
never write in it, reword it, or tidy it. Two entries may share a date; order comes from position in
the file. Distinct labels, always: two identical headings are an error.

**Everything below the generated marker belongs to the tool.** The four-row summary, the examples,
the acceptance check, the decisions, the scope boundary. This is how the decision gets carried out,
not what was decided.

Collapsing the two is what produced specs full of thresholds and script names nobody had agreed to.
The canonical split is `specify` above, `plan` below.

## Cascade doubts, never resolve them

If expanding an entry would mean inventing a threshold, a case, an error path or a policy default,
that is an **open question**, not a decision. It goes back to the operator — in plain text, in one
batch, each with a recommendation attached. `CLAUDE.md` says "surface gaps, do not invent through
them"; surface means _to the operator_, not in prose after the fact.

Recommendations are wanted. Bare questions are not, and neither is skipping the question because the
answer looks obvious.

There is no `Assumptions taken` section for an agent to fill with its own choices after the fact.
Where a generated spec records an assumption, it is a **flag that a gap exists** — the operator then
either accepts it or appends an entry that settles it. It is never a receipt.

## Examples, not descriptions

The single rule that decides whether a spec is worth writing.

A **description** says how the program behaves. An **example** gives an input and the expected
result. A description can be satisfied several incompatible ways; an example can be satisfied one
way, and it becomes the test without anyone re-deriving it.

|             |                                                                                           |
| ----------- | ----------------------------------------------------------------------------------------- |
| Description | "rejects malformed configuration"                                                         |
| Example     | `GITHUB_REPO=a/b/c` → exits non-zero, stdout empty                                        |
| Description | "capped exponential backoff"                                                              |
| Example     | at interval 1000: failures wait 2000, 4000, 8000, 10000, 10000; a success returns to 1000 |

Anywhere a spec can enumerate, it must. Where it genuinely cannot, say so — that is the honest signal
a human has to look at the result rather than at a suite.

## The four rows

`Check`, `Proves`, `Numbers`, `Not this`. They are derived from the operator's prose and shown back
for confirmation, because confirming a structured reading is easier than composing one.

- **Check** — one runnable, deterministic command. Never the smoke run; that is read by a human and
  cannot gate anything.
- **Proves** — what passing demonstrates, **counted**. The body enumerates what the count claims, so
  a drift between them surfaces as a mismatched number rather than passing silently.
- **Numbers** — every threshold, interval and limit, with its value. This is the row that most needs
  the operator's own hand: a threshold is a value judgment wearing the costume of a parameter, and no
  measurement can validate it, because it defines what good means.
- **Not this** — the scope boundary, named specifically. Usually the most useful row: it is what
  stops an agent being helpful in an expensive direction.

## The acceptance check is also the plan step

`apply` runs it to decide whether there is anything to do: green means converged, red means work.
That gives the check a second job, and one consequence. **A check only sees what someone
enumerated.** A requirement no case covers is invisible — the check reports green with the hole still
open, and the tooling then reports "nothing to apply" and is lying. Tightness stops being hygiene and
becomes the condition for the tooling to mean anything.

## A check proves what it sets, never what it omits

An acceptance check that depends on an environment variable must set that variable to an explicit
value in every case it runs, including the case where the requirement is "the default applies" or
"this is switched off". Relying on the variable's absence to mean a baseline is invisible to a
reader of the check and fragile to whoever runs it: an ambient value from the calling shell — a
leftover export, a `.env` nobody re-checked — silently substitutes for the one the check meant to
exercise, and the failure that follows blames the implementation instead of the environment.

This is the same rule as "examples, not descriptions" turned into a habit for the check itself: a
case that means "no simulated failures" writes `GITHUB_MOCK_FAIL_COUNT=0` rather than leaving the
variable unset, exactly as literally as a case that means "two simulated failures" writes `=2`.

One run of `pnpm apply` was blocked for a thousand seconds and 5,370,381 effective tokens by exactly
this gap: a case meant "zero simulated failures" by omission, an ambient shell export supplied a
non-zero value instead, and the check reported a missing issue that the implementation had in fact
printed. The code was not wrong. The check was not describing what it meant.

## Amendments

Reality contradicting a spec is recorded by appending an entry to `What I want`, not by editing what
is there. Then the generated half is regenerated and the code reconciled. There is no rollback step:
withdrawing a decision is an entry saying so, which keeps the record of having been there — a
reverting script would erase exactly the corner you wanted to remember.

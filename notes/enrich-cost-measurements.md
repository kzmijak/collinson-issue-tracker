# What `pnpm enrich` costs, and why

Five runs of the same operation — expanding `specs/001-prototype-issues-reader/spec.md` — while
hunting the cost down. Kept because two of the five measured a bug of mine rather than a model, and
that is worth knowing before anyone reads the numbers as a model comparison.

Effective tokens, per `ClaudeCodeLlm`:
`(cache_read × 0.1 + cache_write × 1.25 + input × 1 + output × 5) × model multiplier`.

| #   | Model      | Tools   | Thinking       | ET      | Outcome                                               |
| --- | ---------- | ------- | -------------- | ------- | ----------------------------------------------------- |
| 1   | sonnet-4-6 | open    | on             | 211,260 | content, decent questions                             |
| 2   | sonnet-5   | open    | on             | 535,676 | content, best questions                               |
| 3   | haiku-4-5  | blocked | off by default | 22,256  | **false blockers, no content**                        |
| 4   | haiku-4-5  | blocked | off by default | 25,154  | **false blockers, no content**                        |
| 5   | haiku-4-5  | blocked | off by default | 7,293   | **prose instead of JSON**                             |
| 6   | sonnet-5   | blocked | on             | 319,584 | content, `test.bash`, 8 assumptions, 3 real questions |

## Runs 1 and 2 measured a bug, not a model

`ClaudeCodeLlm` passed `tools: []` to the Agent SDK. `tools` is not a key of `Options` —
`allowedTools` is — so the option was silently ignored and the agent had the full tool suite. It used
it: run 2 spent 368,426 cache-read tokens walking the repository, and cited
`src/framework/runWorker.ts` by name in a question. Nothing in the prompt mentions that file.

Two consequences. The cost was mostly reading files, so those numbers say nothing about the models.
And the output was **not reproducible** — the same spec against a different working tree gives a
different answer. Blocking tools with an explicit `disallowedTools` list fixed both; `cache-read 0`
in run 6 is the evidence.

`maxTurns` was reporting this correctly and I misread it. `maxTurns: 1` failed with "Reached maximum
number of turns", which I took for an off-by-one in the SDK and worked around by removing the limit.
The agent was spending its turns on file reads. The guard was telling the truth; I switched off the
alarm instead of reading it.

## Haiku cannot hold this instruction

Three runs, three failures of the task rather than the infrastructure. Twice it filled `blocking`
with questions that were not blockers — environment variable names, sort order, output format — each
with an obvious default, and the agent definition says in as many words not to do that. Once it
ignored the JSON contract entirely and answered in prose with markdown headings.

22,000 ET for nothing is not cheap. The unit that matters is cost per completed job.

The failures were caught, not absorbed: `JsonPrompt` found no object, fell back to `{}`, the zod
schema rejected it, and the file was left untouched. That guard is the reason a weak model cannot
blank a spec.

## Run 6: where the money actually goes

```
in 2 · out 30,171 · cache-write 7,148 · cache-read 0
```

The JSON produced is roughly 4,000 tokens. The other ~26,000 output tokens are thinking, and output
carries the ×5 weight before the ×2 model multiplier:

| Component       | ET       | Share |
| --------------- | -------- | ----- |
| thinking        | ~260,000 | 81%   |
| the JSON itself | ~40,000  | 13%   |
| cache write     | ~18,000  | 6%    |

So the tool does not cost 320,000 ET. It costs 40,000, plus 260,000 to deliberate. Disabling thinking
on the same model should land near 58,000 — under target, without dropping to a model that cannot
follow the instruction.

## The unit misled its own author

I reported "319,584 effective tokens" to the operator, who read it as 319k tokens consumed. Raw usage
was 37,321 tokens, about $0.32. ET weights output ×5 and then scales by the model multiplier, so it
runs an order of magnitude above token count by construction.

Both framings are true and neither is sufficient alone: $0.32 makes it sound free, 320k ET makes it
sound ruinous. `PLAN.md`'s open question 4 already settled this — ET internally, dollars at the
reporting boundary, "because that is what a reviewer reads". The CLI prints ET only, which is the
defect. Dollars belong next to it.

Worth carrying into the harness: it will report exactly this unit, to a reader who has not read the
formula.

## Run 8: the task budget settles it

`taskBudget: { total: 45_000 }`, no `effort`, no `thinking` flag, no `maxBudgetUsd`, tools blocked.

```
out 5,718 · cache-write 6,260 · cache-read 0 · one call · stop_reason end_turn
ET 72,880 · ~$0.07
```

Against run 6's 319,584 ET that is 4.4× cheaper, and 11× cheaper than run 7's 798,583. One call
instead of three, no truncation, `blocking: 0`, one open question, and two files — `test.bash` plus
`harness.mjs` — so the mock landed in its own file instead of a heredoc.

The lever was never the model or the effort level. It was telling the model what it had. Left to
itself it thought until it hit the output ceiling; told it had 45,000 tokens, it produced a complete
answer in 5,718.

**Run 7 was self-inflicted twice over.** `thinking: { type: 'disabled' }` was passed alongside an
explicit `effort: 'high'`, and thinking won: all three responses carried thinking blocks with
100KB signatures. Passing a parameter explicitly is not the same as omitting it, even when the value
equals the documented default — the optional options are now spread in only when set.

**And three good results in a row were destroyed by the harness, not the model.** Run 6's content was
deleted to make room for a measurement. Run 7 parsed as prose because the truncation seam corrupted
the JSON. Run 8 was refused because the model answered with repo-root paths — the convention the
prompt itself showed it — while the validator wanted spec-relative ones. Each time the model did its
job and the surrounding code threw the work away.

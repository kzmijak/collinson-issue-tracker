import { z } from 'zod';
import { JsonPrompt } from '../llm/JsonPrompt.js';
import { ModelContractError } from './EnrichPrompt.js';

const findingSchema = z.object({
  area: z.string().min(1),
  quote: z.string().nullable(),
  problem: z.string().min(1),
});

export type Finding = z.infer<typeof findingSchema>;

export const verdictSchema = z.object({
  verdict: z.enum(['accepted', 'rejected']),
  summary: z.string().min(1),
  mustFix: z.array(findingSchema),
  shouldFix: z.array(findingSchema),
  shouldKnow: z.array(findingSchema),
});

export type Verdict = z.infer<typeof verdictSchema>;

export class VerifyPrompt extends JsonPrompt<Verdict> {
  constructor(
    private readonly spec: string,
    private readonly artefacts: string,
    private readonly instructions: string,
  ) {
    super();
  }

  createMessage(): string {
    return [
      this.instructions,
      '',
      'The operator reads your report instead of the specification. Assume they have not opened it.',
      'You are shown the spec and every file it generated, so judge the check by reading it — not by',
      'noting that you cannot see it.',
      '',
      'You do not have the conversation this spec was agreed in, so traceability is unchecked. Say',
      'that once, in the summary, and never again.',
      '',
      '## How to write',
      '',
      'Talk like a competent colleague at the next desk, not like a paper. Short sentences, one idea',
      'each. Say what breaks and what it costs. Then stop.',
      '',
      'Banned outright: "naturally reads as", "arguably", "it should be noted", "implicitly, via",',
      '"this suggests", "one could argue". Banned: semicolons stacking clauses, parentheticals in',
      'the middle of a sentence, and restating the spec before making your point.',
      '',
      'Two rewrites, so the register is unambiguous:',
      '',
      "Too academic: \"'Self-updating' naturally reads as in-place overwrite (e.g. carriage-return",
      'redraw), which would never emit three separate newline-terminated lines; the spec does not say',
      'which reading governs."',
      'Right: "Self-updating sounds like it overwrites one line. But test.bash greps for three',
      'separate lines. Pick one — both cannot be true."',
      '',
      'Too academic: "This is carried into the spec as a decided requirement but no Behaviour row or',
      'line in test.bash exercises an error path; the check can pass with backoff entirely',
      'unimplemented."',
      'Right: "Nothing in test.bash ever makes a request fail, so backoff never runs. Ship it with no',
      'backoff at all and the check still goes green."',
      '',
      'Every finding is three fields, and they stay apart:',
      '',
      '- "area" — one or two words: Falsifiability, Scope, Method, Coverage.',
      '- "quote" — the exact line you object to, copied, or null when the finding is about something',
      '  missing rather than something written. Never paraphrase into this field.',
      '- "problem" — what is wrong and what it lets through. Two sentences at most. Do not repeat',
      '  the quote inside it.',
      '',
      'Never repeat a point across the three lists, and never make the same point twice in one list.',
      '',
      'The summary is at most two sentences: what is wrong in plain words, and traceability',
      'unchecked.',
      '',
      '## Three lists, kept apart',
      '',
      '- "mustFix" — the spec cannot be implemented, or its check cannot fail. Any entry here forces',
      '  the verdict to "rejected". A check that passes without the feature is the worst case: it',
      '  reports success on nothing.',
      '- "shouldFix" — a real weakness that does not stop work.',
      '- "shouldKnow" — not a defect. A choice the enricher made alone, coverage the check does not',
      '  reach, anything the operator would be annoyed to find out later.',
      '',
      'Reject for a defect, never a preference. Empty "mustFix" and "accepted" must agree.',
      '',
      'Return one JSON object and nothing else:',
      '{ "verdict": "accepted" | "rejected", "summary": "one or two sentences",',
      '  "mustFix": [{ "area": "...", "quote": "..." | null, "problem": "..." }],',
      '  "shouldFix": [], "shouldKnow": [] }',
      '',
      'Here is the specification.',
      '',
      this.spec,
      '',
      this.artefacts
        ? `## The files this spec generated\n\n${this.artefacts}`
        : '## The files this spec generated\n\n(none yet — the check cannot be inspected)',
    ].join('\n');
  }

  protected outputParser(output: object): Verdict {
    const parsed = verdictSchema.safeParse(output);
    if (!parsed.success) {
      throw new ModelContractError(
        `the verifier did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. Nothing was written.`,
      );
    }
    if (parsed.data.mustFix.length > 0 && parsed.data.verdict === 'accepted') {
      return { ...parsed.data, verdict: 'rejected' };
    }
    return parsed.data;
  }
}

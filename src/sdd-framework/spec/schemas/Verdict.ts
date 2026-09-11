import { z } from 'zod';

const findingSchema = z.object({
  area: z.string().min(1).describe('one or two words: Falsifiability, Scope, Method, Coverage'),
  quote: z
    .string()
    .describe('the exact line you object to, copied, never paraphrased')
    .nullable()
    .describe('null when the finding is about something missing'),
  problem: z.string().min(1).describe('what is wrong and what it lets through, two sentences max'),
});

export type Finding = z.infer<typeof findingSchema>;

/**
 * A model can send "shouldFix"/"shouldKnow" as bare strings — one run did, and the old
 * all-or-nothing schema threw the whole verdict away over it, including two correct "mustFix"
 * findings. A bare string becomes a same-shaped finding instead of a parse failure; "mustFix" stays
 * strict, because its "quote" is what lets the operator check a reject reason against the spec.
 */
const softFindingSchema = z.union([
  findingSchema,
  z
    .string()
    .min(1)
    .transform((problem) => ({ area: 'Note', quote: null, problem })),
]);

export const verdictSchema = z.object({
  verdict: z.enum(['approved', 'rejected']),
  summary: z.string().min(1).describe('at most two sentences: what is wrong, in plain words'),
  mustFix: z
    .array(findingSchema)
    .describe('the spec cannot be implemented, or its ACCS cannot fail; any entry means rejected'),
  shouldFix: z.array(softFindingSchema).describe('a real weakness that does not stop work'),
  shouldKnow: z
    .array(softFindingSchema)
    .describe('not a defect: a choice made alone, or coverage the ACCS does not reach'),
  fix: z
    .enum(['spec', 'accs'])
    .describe(
      "what has to be redone when rejected — 'spec': the enriched spec must change, which rebuilds the ACCS too; 'accs': only the ACCS fails to honour accs.md or the enriched spec's contract",
    )
    // Missing means the safe route: regenerating both is never wrong, only more expensive.
    .default('spec'),
});

export type Verdict = z.infer<typeof verdictSchema>;

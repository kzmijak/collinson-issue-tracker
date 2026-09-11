import { z } from 'zod';

const specCase = z.object({
  input: z.string().min(1).describe('the input, literally'),
  expected: z.string().min(1).describe('the expected result, literally'),
});

export const enrichedBodySchema = z.object({
  summary: z.string().min(1).describe('one sentence, present tense, what this does'),
  check: z
    .string()
    .min(1)
    .describe('exactly `bash <the ACCS path from the message>`, nothing else'),
  proves: z.string().min(1).describe('what passing demonstrates, with counts'),
  numbers: z
    .string()
    .min(1)
    .describe("each threshold as name then value, terse, separated by ' - ', no sentences"),
  notThis: z.string().min(1).describe("the scope boundary, specific, separated by ' - '"),
  doneWhen: z
    .array(
      z.string().min(1).describe('a file that exists and what it holds, or a command that exits 0'),
    )
    .min(1),
  behaviours: z
    .array(
      z.object({
        name: z.string().min(1).describe('behaviour name'),
        cases: z.array(specCase).min(1),
      }),
    )
    .min(1),
  acceptance: z.object({
    command: z.string().min(1).describe('the command that runs the ACCS'),
    expectation: z.string().min(1).describe('what that command does when the spec is satisfied'),
  }),
  decisions: z.array(
    z.object({
      decision: z.string().min(1).describe('what was decided'),
      why: z.string().min(1).describe('which dated entry it came from'),
    }),
  ),
  outOfScope: z.array(z.string().min(1).describe('a plausible next thought, named specifically')),
  openQuestions: z
    .array(z.string().min(1).describe('a question with your recommendation, settled by yes or no'))
    .describe('at most three'),
  assumptions: z.array(
    z.object({
      question: z.string().min(1).describe('what the prose did not settle'),
      choice: z.string().min(1).describe('what you took, and why'),
    }),
  ),
  files: z
    .array(
      z.object({
        path: z.string().min(1).describe("relative to the spec's own directory, never leaving it"),
        content: z.string().min(1).describe('the whole file'),
        executable: z.boolean().describe('true for scripts').optional(),
      }),
    )
    .min(1)
    .describe('every file the ACCS needs, the ACCS itself among them'),
});

export const enrichmentSchema = z.object({
  blocking: z.array(z.string().min(1).describe('a question that stops work, and why it stops it')),
  body: enrichedBodySchema.nullable().describe('null when "blocking" is not empty'),
});

export type EnrichedBody = z.infer<typeof enrichedBodySchema>;
export type Enrichment = z.infer<typeof enrichmentSchema>;

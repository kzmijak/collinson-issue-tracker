import { z } from 'zod';

const specCase = z.object({
  input: z.string().min(1).describe('the input, literally'),
  expected: z.string().min(1).describe('the expected result, literally'),
});

export const enrichedBodySchema = z.object({
  summary: z.string().min(1).describe('one sentence, present tense, what this does'),
  contract: z
    .array(
      z.object({
        facade: z
          .string()
          .min(1)
          .describe(
            'exactly as the ACCS will use it: a command, an environment variable, an HTTP endpoint, the format of an output line, a file',
          ),
        promise: z.string().min(1).describe('what the implementation guarantees about it'),
      }),
    )
    .min(1)
    .describe(
      'every facade the ACCS may rely on — the only things it may assume about the implementation',
    ),
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
  drawbacks: z
    .array(z.string().min(1).describe('a weakness of the chosen design, and what it costs'))
    .default([])
    .describe('expected drawbacks; empty when there are none'),
  assumptions: z.array(
    z.object({
      question: z.string().min(1).describe('what the prose did not settle'),
      choice: z.string().min(1).describe('what you took, and why'),
    }),
  ),
});

export const enrichmentSchema = z.object({
  blocking: z.array(
    z.string().min(1).describe('a design flaw in spec.md that stops work, and why it stops it'),
  ),
  body: enrichedBodySchema.nullable().describe('null when "blocking" is not empty'),
});

export type EnrichedBody = z.infer<typeof enrichedBodySchema>;
export type Enrichment = z.infer<typeof enrichmentSchema>;

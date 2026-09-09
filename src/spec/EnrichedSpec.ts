import { z } from 'zod';

const specCase = z.object({ input: z.string().min(1), expected: z.string().min(1) });

export const enrichedBodySchema = z.object({
  summary: z.string().min(1),
  check: z.string().min(1),
  proves: z.string().min(1),
  numbers: z.string().min(1),
  notThis: z.string().min(1),
  doneWhen: z.array(z.string().min(1)).min(1),
  behaviours: z
    .array(z.object({ name: z.string().min(1), cases: z.array(specCase).min(1) }))
    .min(1),
  acceptance: z.object({ command: z.string().min(1), expectation: z.string().min(1) }),
  decisions: z.array(z.object({ decision: z.string().min(1), why: z.string().min(1) })),
  outOfScope: z.array(z.string().min(1)),
  openQuestions: z.array(z.string().min(1)),
  assumptions: z.array(z.object({ question: z.string().min(1), choice: z.string().min(1) })),
  files: z
    .array(
      z.object({
        path: z.string().min(1),
        content: z.string().min(1),
        executable: z.boolean().optional(),
      }),
    )
    .min(1),
});

export const enrichmentSchema = z.object({
  blocking: z.array(z.string().min(1)),
  body: enrichedBodySchema.nullable(),
});

export type EnrichedBody = z.infer<typeof enrichedBodySchema>;
export type Enrichment = z.infer<typeof enrichmentSchema>;

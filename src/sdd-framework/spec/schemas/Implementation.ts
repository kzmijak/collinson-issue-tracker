import { z } from 'zod';
import { findingSchema } from './Verdict.js';

const pickSchema = z.object({
  decision: z.string().min(1).describe('the open question, under twelve words'),
  chose: z.string().min(1).describe('what you did, one line'),
  why: z.string().min(1).describe('one sentence'),
});

export type ImplementationPick = z.infer<typeof pickSchema>;

export const implementationSchema = z.object({
  summary: z
    .string()
    .min(1)
    .describe('at most three sentences: what you built, and whether it works'),
  files: z
    .array(z.string().describe('repo-relative path'))
    .describe('every file you created or changed, complete'),
  picks: z
    .array(pickSchema)
    .describe('one entry per choice the spec left open; empty only if it decided everything'),
  findings: z
    .array(findingSchema)
    .default([])
    .describe('every bug or loophole found in the spec or the ACCS; empty when there were none'),
  fix: z
    .enum(['none', 'full', 'accs'])
    .describe(
      "'none': the spec stands; 'full': the enriched spec is flawed, so it is rewritten and the ACCS rebuilt with it; 'accs': fixing the ACCS suite alone is enough",
    )
    .default('none'),
  blocked: z
    .string()
    .describe('at most three sentences naming what conflicts with what')
    .nullable()
    .describe(
      'null when you are done or ran out of time or budget — only a spec or ACCS that cannot be satisfied blocks',
    ),
  remedy: z
    .string()
    .describe('the single thing the operator has to do, one line; the bare command if it is one')
    .nullable()
    .describe('null unless blocked'),
});

export type Implementation = z.infer<typeof implementationSchema>;

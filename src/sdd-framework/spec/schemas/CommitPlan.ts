import { z } from 'zod';

export const commitPlanSchema = z.object({
  commits: z
    .array(
      z.object({
        message: z
          .string()
          .min(1)
          .describe(
            'Conventional Commits: type(scope): subject, blank line, body with what and why; no trailer',
          ),
        files: z.array(z.string().min(1).describe('path')).min(1),
        why: z.string().min(1).describe('one line: why these files are one change'),
      }),
    )
    .min(1),
  unassigned: z.array(z.string().describe('path you cannot place in any commit')),
});

export type CommitPlan = z.infer<typeof commitPlanSchema>;

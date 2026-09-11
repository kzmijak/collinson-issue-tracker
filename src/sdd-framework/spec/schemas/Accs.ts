import { z } from 'zod';

const fileSchema = z.object({
  path: z.string().min(1).describe("relative to the spec's output directory, never leaving it"),
  content: z.string().min(1).describe('the whole file'),
  executable: z.boolean().describe('true for scripts').optional(),
});

export const accsSchema = z.object({
  files: z
    .array(fileSchema)
    .min(1)
    .describe('every file the ACCS needs, the ACCS itself among them'),
});

export type AccsFiles = z.infer<typeof accsSchema>;

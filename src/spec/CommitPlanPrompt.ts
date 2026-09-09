import { z } from 'zod';
import { JsonPrompt } from '../llm/JsonPrompt.js';
import { ModelContractError } from './EnrichPrompt.js';

export const commitPlanSchema = z.object({
  commits: z
    .array(
      z.object({
        message: z.string().min(1),
        files: z.array(z.string().min(1)).min(1),
        why: z.string().min(1),
      }),
    )
    .min(1),
  unassigned: z.array(z.string()),
});

export type CommitPlan = z.infer<typeof commitPlanSchema>;

export class CommitPlanPrompt extends JsonPrompt<CommitPlan> {
  constructor(
    private readonly instructions: string,
    private readonly state: string,
  ) {
    super();
  }

  createMessage(): string {
    return [
      this.instructions,
      '',
      'You are producing a commit plan as data. You do not run git — a script does, after a human',
      'approves what you propose. Group the working tree into atomic commits: one logical change',
      'each, never consolidated to make a shorter list. A spec commit lands before the code that',
      'satisfies it. Every changed file belongs to exactly one commit, or to "unassigned" if you',
      'genuinely cannot place it — say so rather than inventing a home for it.',
      '',
      'Write the message as Conventional Commits, subject then a blank line then a body that says',
      'what changed and why. Do not write any trailer; the script appends attribution itself.',
      '',
      'Return one JSON object and nothing else:',
      '{ "commits": [{ "message": "type(scope): subject\\n\\nbody", "files": ["path"],',
      '  "why": "one line, why these files are one change" }], "unassigned": ["path"] }',
      '',
      'Here is the working tree.',
      '',
      this.state,
    ].join('\n');
  }

  protected outputParser(output: object): CommitPlan {
    const parsed = commitPlanSchema.safeParse(output);
    if (!parsed.success) {
      throw new ModelContractError(
        `the commit planner did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. Nothing was committed.`,
      );
    }
    return parsed.data;
  }
}

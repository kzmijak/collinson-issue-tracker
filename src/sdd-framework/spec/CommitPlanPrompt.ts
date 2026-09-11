import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { commitPlanSchema, type CommitPlan } from './schemas/CommitPlan.js';
import { ModelContractError } from './EnrichPrompt.js';

export class CommitPlanPrompt extends JsonPrompt<CommitPlan> {
  constructor(
    private readonly instructions: string,
    private readonly state: string,
  ) {
    super();
  }

  static outputSpecification = schemaToSpec(commitPlanSchema);

  createMessage(): string {
    return [this.instructions, '', 'Here is the working tree.', '', this.state].join('\n');
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

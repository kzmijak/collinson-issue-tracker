import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { accsCorrectionSchema, type AccsCorrection } from './schemas/AccsCorrection.js';
import { ModelContractError } from './EnrichPrompt.js';
import type { Verification } from './metrics.js';

function findingLines(heading: string, items: Verification['mustFix']): string[] {
  if (items.length === 0) return [];
  return [
    `### ${heading}`,
    '',
    ...items.map(
      (item) => `- [${item.area}] ${item.quote ? `"${item.quote}" — ` : ''}${item.problem}`,
    ),
    '',
  ];
}

/**
 * A narrower correction than `pnpm enrich`: a reviewer's feedback here is entirely about what the
 * check does or does not prove, not about what was decided. Only the check changes — the summary,
 * the numbers, the behaviours and the decisions were already read and accepted, and regenerating
 * them alongside the fix risks a silent drift from what a reviewer approved, at the cost of
 * re-deriving prose that was never in question.
 */
export class AccsCorrectionPrompt extends JsonPrompt<AccsCorrection> {
  constructor(
    private readonly instructions: string,
    private readonly specBody: string,
    private readonly currentAccs: string,
    private readonly accsPath: string,
    private readonly verification: Verification,
  ) {
    super();
  }

  static outputSpecification = schemaToSpec(accsCorrectionSchema);

  createMessage(): string {
    return [
      this.instructions,
      '',
      '## You are fixing the ACCS only',
      '',
      `The reviewer returned "${this.verification.verdict}": ${this.verification.summary}`,
      '',
      ...findingLines('Must fix', this.verification.mustFix),
      ...findingLines('Should fix', this.verification.shouldFix),
      '## What the ACCS has to prove (for reference only)',
      '',
      this.specBody,
      '',
      `## The current ${this.accsPath}`,
      '',
      '```bash',
      this.currentAccs,
      '```',
    ].join('\n');
  }

  protected outputParser(output: object): AccsCorrection {
    const parsed = accsCorrectionSchema.safeParse(output);
    if (!parsed.success) {
      throw new ModelContractError(
        `the ACCS correction did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. Nothing was written.`,
      );
    }
    return parsed.data;
  }
}

import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { accsSchema, type AccsFiles } from './schemas/Accs.js';
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

abstract class AccsFilesPrompt extends JsonPrompt<AccsFiles> {
  static outputSpecification = schemaToSpec(accsSchema);

  protected outputParser(output: object): AccsFiles {
    const parsed = accsSchema.safeParse(output);
    if (!parsed.success) {
      throw new ModelContractError(
        `the ACCS author did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. Nothing was written.`,
      );
    }
    return parsed.data;
  }
}

export interface AccsSources {
  /** accs.md — the operator's method, deliberately loose. */
  accs: string;
  /** The enriched spec without its meta block — the contract the ACCS has to honour. */
  enrichedSpec: string;
  accsPath: string;
}

/** Writes the ACCS from scratch, for an enriched spec that has just been (re)generated. */
export class AccsPrompt extends AccsFilesPrompt {
  constructor(private readonly sources: AccsSources) {
    super();
  }

  createMessage(): string {
    return [
      `The ACCS will be written to \`${this.sources.accsPath}\`.`,
      '',
      '## accs.md',
      '',
      this.sources.accs,
      '',
      '## output/enriched-spec.md',
      '',
      this.sources.enrichedSpec,
    ].join('\n');
  }
}

/**
 * Repairs the ACCS a reviewer rejected, leaving the enriched spec alone: the verdict was about the
 * script, so regenerating the spec with it would only risk drifting prose that was already approved.
 */
export class AccsCorrectionPrompt extends AccsFilesPrompt {
  constructor(
    private readonly sources: AccsSources,
    private readonly currentAccs: string,
    private readonly verification: Verification,
  ) {
    super();
  }

  createMessage(): string {
    return [
      '## You are fixing the ACCS only',
      '',
      `The reviewer returned "${this.verification.verdict}": ${this.verification.summary}`,
      '',
      ...findingLines('Must fix', this.verification.mustFix),
      ...findingLines('Should fix', this.verification.shouldFix),
      '## accs.md',
      '',
      this.sources.accs,
      '',
      '## output/enriched-spec.md',
      '',
      this.sources.enrichedSpec,
      '',
      `## The current ${this.sources.accsPath}`,
      '',
      '```bash',
      this.currentAccs,
      '```',
    ].join('\n');
  }
}

import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { verdictSchema, type Verdict } from './schemas/Verdict.js';
import { ModelContractError } from './EnrichPrompt.js';

export class VerifyPrompt extends JsonPrompt<Verdict> {
  constructor(
    private readonly spec: string,
    private readonly artefacts: string,
  ) {
    super();
  }

  static outputSpecification = schemaToSpec(verdictSchema);

  createMessage(): string {
    return [
      '## The specification',
      '',
      this.spec,
      '',
      this.artefacts
        ? `## The files this spec generated\n\n${this.artefacts}`
        : '## The files this spec generated\n\n(none yet — the ACCS cannot be inspected)',
      '',
      '## Your task',
      '',
      'Verify this enrichment and answer with the verdict.',
    ].join('\n');
  }

  protected outputParser(output: object): Verdict {
    const parsed = verdictSchema.safeParse(output);
    if (!parsed.success) {
      throw new ModelContractError(
        `the verifier did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. Nothing was written.`,
      );
    }
    if (parsed.data.mustFix.length > 0 && parsed.data.verdict === 'approved') {
      return { ...parsed.data, verdict: 'rejected' };
    }
    return parsed.data;
  }
}

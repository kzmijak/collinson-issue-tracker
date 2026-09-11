import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { verdictSchema, type Verdict } from './schemas/Verdict.js';
import { ModelContractError } from './EnrichPrompt.js';
import type { Verification } from './metrics.js';

export class VerifyPrompt extends JsonPrompt<Verdict> {
  constructor(
    private readonly spec: string,
    private readonly artefacts: string,
    /** The last rejection, so a fresh verifier checks it was fixed instead of starting over. */
    private readonly previous: Verification | null = null,
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
      ...(this.previous ? previousVerdict(this.previous) : []),
      '',
      '## Your task',
      '',
      'Verify this enrichment and answer with the verdict.',
      ...(this.previous
        ? [
            'First check whether each finding of the previous verdict was fixed. Raise a new mustFix only for something that blocks the implementation.',
          ]
        : []),
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

function previousVerdict(previous: Verification): string[] {
  const lines = (items: Verification['mustFix']) =>
    items.map(
      (item) => `- [${item.area}] ${item.quote ? `"${item.quote}" — ` : ''}${item.problem}`,
    );

  return [
    '',
    `## The previous verdict (${previous.by ?? 'verifier'}, rejected)`,
    '',
    previous.summary,
    ...(previous.mustFix.length ? ['', '### Must fix', '', ...lines(previous.mustFix)] : []),
    ...(previous.shouldFix.length ? ['', '### Should fix', '', ...lines(previous.shouldFix)] : []),
  ];
}

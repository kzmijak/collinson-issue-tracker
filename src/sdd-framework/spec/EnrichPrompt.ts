import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { enrichmentSchema, type Enrichment } from './schemas/Enrichment.js';

export type EnrichMode = 'default' | 'no-questions';

export interface Feedback {
  /** The generated half being corrected. */
  previous: string;
  /** Whether the operator has appended an entry since this verdict was given. */
  operatorSectionChanged: boolean;
  verdict: 'approved' | 'rejected';
  summary: string;
  mustFix: { area: string; quote: string | null; problem: string }[];
  shouldFix: { area: string; quote: string | null; problem: string }[];
  shouldKnow: { area: string; quote: string | null; problem: string }[];
}

export class ModelContractError extends Error {}

/**
 * Blocking writes nothing to disk, so a list of "blockers" costs the operator a round trip and
 * leaves them with no spec at all. More than one is the signature of an enricher asking instead of
 * deciding: the surplus becomes open questions and the spec gets written.
 */
function demoteOverblocking(enrichment: Enrichment): Enrichment {
  if (enrichment.blocking.length <= 1 || !enrichment.body) return enrichment;

  const [kept, ...demoted] = enrichment.blocking;
  return {
    blocking: [kept],
    body: { ...enrichment.body, openQuestions: [...enrichment.body.openQuestions, ...demoted] },
  };
}

function quote(output: string): string {
  const trimmed = output.trim();
  return JSON.stringify(trimmed.length > 300 ? `${trimmed.slice(0, 300)}…` : trimmed);
}

export class EnrichPrompt extends JsonPrompt<Enrichment> {
  constructor(
    private readonly operatorSection: string,
    private readonly mode: EnrichMode = 'default',
    private readonly accsPath = 'accs.bash',
    private readonly feedback?: Feedback,
  ) {
    super();
  }

  createMessage(): string {
    return [
      ...(this.mode === 'no-questions'
        ? ['MODE: --no-questions. "blocking" and "openQuestions" must be empty arrays.', '']
        : []),
      `The ACCS will be written to \`${this.accsPath}\`.`,
      '',
      ...(this.feedback ? correctionBrief(this.feedback) : []),
      'Here is the operator section of a specification. Expand it.',
      '',
      this.operatorSection,
    ].join('\n');
  }

  parseOutput(output: string): Enrichment {
    if (!output.includes('{')) {
      throw new ModelContractError(
        `the model returned no JSON at all. Nothing was written. Raw output: ${quote(output)}`,
      );
    }
    return super.parseOutput(output);
  }

  protected outputParser(output: object): Enrichment {
    const parsed = enrichmentSchema.safeParse(output);

    if (!parsed.success) {
      const fields = parsed.error.issues.map((issue) => issue.path.join('.') || '(root)');
      throw new ModelContractError(
        `the model returned JSON that does not match the contract — missing or invalid: ` +
          `${[...new Set(fields)].join(', ')}. Nothing was written. The raw output is logged above.`,
      );
    }
    return demoteOverblocking(parsed.data);
  }

  static outputSpecification = schemaToSpec(enrichmentSchema);
}

function findings(items: Feedback['mustFix']): string[] {
  return items.map(
    (item) => `- [${item.area}] ${item.quote ? `"${item.quote}" — ` : ''}${item.problem}`,
  );
}

/**
 * In fix mode the enricher is shown its own last answer and what a reviewer said about it. This is
 * the one time it sees its previous output: everywhere else it stays a function of the operator's
 * words alone, so that the same input keeps producing a comparable spec.
 */
function correctionBrief(feedback: Feedback): string[] {
  return [
    '## You are correcting your own previous answer',
    '',
    `A reviewer returned ${feedback.verdict}: ${feedback.summary}`,
    '',
    feedback.operatorSectionChanged
      ? 'The operator has appended an entry since that verdict.'
      : 'The operator section is unchanged since that verdict.',
    '',
    ...(feedback.mustFix.length ? ['### Must fix', '', ...findings(feedback.mustFix), ''] : []),
    ...(feedback.shouldFix.length
      ? ['### Should fix', '', ...findings(feedback.shouldFix), '']
      : []),
    ...(feedback.shouldKnow.length
      ? ['### Worth knowing', '', ...findings(feedback.shouldKnow), '']
      : []),
    '### Your previous generated half',
    '',
    feedback.previous,
    '',
  ];
}

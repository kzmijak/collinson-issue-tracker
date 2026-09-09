import { JsonPrompt } from '../llm/JsonPrompt.js';
import { enrichmentSchema, type Enrichment } from './EnrichedSpec.js';

export type EnrichMode = 'default' | 'no-questions';

export interface Feedback {
  /** The generated half being corrected. */
  previous: string;
  /** Whether the operator has appended an entry since this verdict was given. */
  operatorSectionChanged: boolean;
  verdict: 'accepted' | 'rejected';
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
    private readonly testBashPath = 'test.bash',
    private readonly feedback?: Feedback,
  ) {
    super();
  }

  createMessage(): string {
    return [
      this.mode === 'no-questions'
        ? 'MODE: --no-questions. Ask nothing. "blocking" and "openQuestions" must be empty arrays.'
        : 'MODE: default. You may ask at most three questions, and only where the answer changes what the operator ends up with.',
      '',
      'Decide everything the operator did not specify and record each choice in "assumptions".',
      'Where their prose delegates — "no format predefined", "the first proposal establishes the',
      'convention" — take the choice and put it in "decisions". Naming, output format, fixture',
      'contents, test mechanics, caps and internal defaults are yours; asking about them is refusing',
      'to do your half.',
      '',
      '"blocking" is only for a spec that would be meaningless without an answer: two operator',
      'entries contradicting each other, or something that cannot exist. It writes nothing to disk,',
      'so the operator gets no spec at all — more than one item there means you are wrong.',
      '',
      `Your test script will be written to \`${this.testBashPath}\`. The "check" row must be exactly ` +
        `\`bash ${this.testBashPath}\` and nothing else — no inlined procedure, no other filename.`,
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

  static outputSpecification = `
Return one JSON object and nothing else.

{
  "blocking": ["a question that stops work, and why it stops it"],
  "body": {
    "summary": "one sentence, present tense, what this does",
    "check": "bash <the test script path given above> — exactly that, nothing else",
    "proves": "what passing demonstrates, with counts",
    "numbers": "each threshold as name-then-value, terse, separated by ' - '. This row is scanned in seconds: no sentences, no parentheticals",
    "notThis": "the scope boundary, specific, separated by ' - '",
    "doneWhen": ["a file that exists and what it exports, or a command that exits 0"],
    "behaviours": [{ "name": "...", "cases": [{ "input": "...", "expected": "..." }] }],
    "acceptance": { "command": "...", "expectation": "..." },
    "decisions": [{ "decision": "...", "why": "which dated entry it came from" }],
    "outOfScope": ["a plausible next thought, named specifically"],
    "openQuestions": ["a question with your recommendation, that a yes or no settles"],
    "assumptions": [{ "question": "what you could not settle from the prose", "choice": "what you took, and why" }],
    "files": [{ "path": "test.bash", "content": "#!/usr/bin/env bash\\nset -euo pipefail\\n...", "executable": true }]
  }
}

The test drives the system from the outside only: the command the operator named, the environment
variables, stdout, stderr, the exit code. Never import from src/. Never name a module path, an
exported function or a parameter — none of that is in the operator's prose, so choosing it invents
an interface that belongs to the implementer. A check that imports internals can pass while the
entrypoint is broken.

"body" is null when "blocking" is non-empty, and an object otherwise.
"check" should invoke the test script rather than inlining the procedure.
`;
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
    `A reviewer read it and returned ${feedback.verdict}: ${feedback.summary}`,
    '',
    'Fix every "must fix" — those are why it was rejected. Fix the "should fix" items unless doing',
    'so would contradict the operator. Address "worth knowing" by making the choice explicit in',
    'the spec, not by removing what it describes.',
    '',
    feedback.operatorSectionChanged
      ? 'The operator has appended an entry since that verdict, so read their section again — it may already settle some of this. The findings below are about your previous answer, not about their new words.'
      : 'The operator has not appended anything since that verdict, so their words are unchanged. Do not invent new requirements while correcting.',
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

import type { EnrichedBody } from './EnrichedSpec.js';

export type VerificationStatus = 'unverified' | 'accepted' | 'rejected';

export interface SpecMeta {
  generatedOn: string;
  entries: string[];
  sourceSha: string;
  files: string[];
  status: VerificationStatus;
}

export function renderSpec(body: EnrichedBody, meta: SpecMeta): string {
  return [
    renderMeta(meta),
    '## Read this first',
    '',
    body.summary,
    '',
    renderRows(body),
    renderOpenQuestions(body.openQuestions),
    renderAssumptions(body.assumptions),
    '## Done when',
    '',
    ...body.doneWhen.map((item) => `- ${item}`),
    '',
    '## Behaviour',
    ...body.behaviours.flatMap(renderBehaviour),
    '',
    '## Acceptance check',
    '',
    '```',
    body.acceptance.command,
    '```',
    '',
    body.acceptance.expectation,
    '',
    '## Decisions already made',
    '',
    ...body.decisions.map(({ decision, why }) => `- **${decision}** — ${why}`),
    '',
    '## Out of scope',
    '',
    ...body.outOfScope.map((item) => `- ${item}`),
    '',
  ].join('\n');
}

function renderMeta({ generatedOn, entries, sourceSha, files, status }: SpecMeta): string {
  return [
    '<!-- enrich:meta',
    `generated: ${generatedOn}`,
    `source-sha: ${sourceSha}`,
    `status: ${status}`,
    ...entries.map((entry) => `from: ${entry}`),
    ...files.map((file) => `file: ${file}`),
    '-->',
    '',
  ].join('\n');
}

function renderRows(body: EnrichedBody): string {
  return [
    '|              |     |',
    '| ------------ | --- |',
    `| **Check**    | ${body.check} |`,
    `| **Proves**   | ${body.proves} |`,
    `| **Numbers**  | ${body.numbers} |`,
    `| **Not this** | ${body.notThis} |`,
    '',
  ].join('\n');
}

function renderOpenQuestions(questions: string[]): string {
  if (questions.length === 0) return '';
  return ['## Open questions', '', ...questions.map((q) => `- ${q}`), ''].join('\n');
}

function renderAssumptions(assumptions: EnrichedBody['assumptions']): string {
  if (assumptions.length === 0) return '';
  return [
    '## Assumptions taken',
    '',
    'Gaps the enricher had to settle without the operator. Each is a flag, not a decision — read them',
    'and append an entry if any is wrong.',
    '',
    ...assumptions.map(({ question, choice }) => `- **${question}** ${choice}`),
    '',
  ].join('\n');
}

function renderBehaviour(behaviour: EnrichedBody['behaviours'][number]): string[] {
  return [
    '',
    `### ${behaviour.name}`,
    '',
    '| input | expected |',
    '| ----- | -------- |',
    ...behaviour.cases.map(({ input, expected }) => `| ${input} | ${expected} |`),
  ];
}

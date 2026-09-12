import type { EnrichedBody } from './schemas/Enrichment.js';
import { ACCS_SCRIPT } from './specFiles.js';

export type VerificationStatus = 'draft' | 'approved' | 'rejected';

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
    '## Contract',
    '',
    'The facades the ACCS may rely on — nothing else about the implementation can be assumed.',
    '',
    '| facade | promise |',
    '| ------ | ------- |',
    ...body.contract.map(({ facade, promise }) => `| ${facade} | ${promise} |`),
    '',
    renderExports(body.exports),
    renderOpenQuestions(body.openQuestions),
    renderAssumptions(body.assumptions),
    '## Done when',
    '',
    ...body.doneWhen.map((item) => `- ${item}`),
    '',
    '## Behaviour',
    ...body.behaviours.flatMap(renderBehaviour),
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
    `| **Check**    | \`bash output/${ACCS_SCRIPT}\` |`,
    `| **Numbers**  | ${body.numbers} |`,
    `| **Not this** | ${body.notThis} |`,
    '',
  ].join('\n');
}

/** Read by the enrichment of every later spec, which is why it is a section and not a decision. */
export const EXPORTS_HEADING = '## Exports';

function renderExports(exports: EnrichedBody['exports']): string {
  if (exports.length === 0) return '';

  return [
    EXPORTS_HEADING,
    '',
    'What later specs have to honour. Changing any of these breaks the specs that rely on them.',
    '',
    '| name | value | why |',
    '| ---- | ----- | --- |',
    ...exports.map(({ name, value, why }) => `| ${name} | ${value} | ${why} |`),
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

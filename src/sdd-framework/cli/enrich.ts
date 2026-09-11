import { enrich } from '../spec/enrich.js';
import { enrichAccs } from '../spec/enrichAccs.js';
import { type ClaudeCodeLlm, QueryFailedError } from '../llm/ClaudeCodeLlm.js';
import {
  accsAuthorBorrowsIdentity,
  ACCS_AUTHOR_DEFINITION,
  createAccsAuthor,
  createEnricher,
  ENRICH_TASK_BUDGET_TOKENS,
  SPEC_MODEL,
} from './agents.js';
import { ModelContractError, type EnrichMode } from '../spec/EnrichPrompt.js';
import { resolveSpecPath, SpecNotFoundError, specName } from '../spec/resolveSpecPath.js';
import { SpecFormatError } from '../spec/SpecFile.js';
import { consoleLogger } from './consoleLogger.js';
import { banner, note, paragraph, section } from './report.js';
import { startProgress } from './progress.js';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const accsOnly = args.includes('--accs');
  const mode: EnrichMode = args.includes('--no-questions') ? 'no-questions' : 'default';
  const force = args.includes('--force');
  const target = args.find((arg) => !arg.startsWith('--'));

  if (!target) {
    consoleLogger.error('usage: pnpm enrich <spec> [--accs] [--no-questions] [--force]');
    return 1;
  }

  const path = resolveSpecPath(target);
  const model = SPEC_MODEL;
  if (accsAuthorBorrowsIdentity()) {
    note(
      `${ACCS_AUTHOR_DEFINITION} does not exist yet — the ACCS author borrows the enricher's identity.`,
    );
  }

  if (accsOnly) return runAccsOnly(path, model, target);

  const enricher = createEnricher();
  const accsAuthor = createAccsAuthor();
  const progress = startProgress(`enriching ${specName(path)}`);
  enricher.observe(progress.activity);
  accsAuthor.observe(progress.activity);
  const result = await enrich(path, { enricher, accsAuthor }, mode, {
    model,
    taskBudgetTokens: ENRICH_TASK_BUDGET_TOKENS,
    force,
  }).finally(progress.stop);

  if (result.status !== 'unchanged') {
    consoleLogger.info(
      `usage: enricher ${breakdown(enricher)} · ACCS author ${breakdown(accsAuthor)}`,
    );
  }

  if (result.status === 'unchanged') {
    banner('UNCHANGED', 'dim', path);
    paragraph('spec.md and accs.md have not changed and the last result was not rejected.');
    if (result.lastReport) {
      consoleLogger.info(`\n${result.lastReport}`);
      note('`--force` regenerates as-is.');
      return 0;
    }
    paragraph('What the last run left you:');

    section(
      'Open questions',
      result.openQuestions.map((question) => ({ body: question })),
      '?',
      'yellow',
    );
    section(
      'Assumptions taken',
      result.assumptions.map((assumption) => ({ body: assumption })),
      'i',
      'blue',
    );
    note('Append an entry to settle any of these, or `--force` to regenerate as-is.');
    return 0;
  }

  if (result.status === 'blocked') {
    banner('BLOCKED', 'red', path, cost(result.effectiveTokens));
    paragraph('This cannot be expanded until the following are settled.');
    section(
      'Needs a decision',
      result.blocking.map((question) => ({ body: question })),
      '?',
      'red',
    );
    note('Append a dated entry under `## What I want` that settles these, then run again.');
    note(`report: ${result.report}`);
    return 1;
  }

  banner(result.corrected ? 'CORRECTED' : 'WRITTEN', 'green', path, cost(result.effectiveTokens));
  section(
    'Files',
    [
      {
        body: 'The generated half and everything the check needs.',
        bullets: [
          ...result.files.map((file) => file),
          ...result.pruned.map((file) => `${file} — removed, no longer generated`),
        ],
      },
    ],
    '+',
    'green',
  );
  section(
    'Open questions',
    result.openQuestions.map((question) => ({ body: question })),
    '?',
    'yellow',
  );
  note(`report: ${result.report}`);
  note(`Read the report before the spec: pnpm verify ${target}`);
  return 0;
}

async function runAccsOnly(path: string, model: string, target: string): Promise<number> {
  const llm = createAccsAuthor();
  const progress = startProgress(`fixing the ACCS for ${specName(path)}`);
  llm.observe(progress.activity);
  const result = await enrichAccs(path, llm, {
    model,
    taskBudgetTokens: ENRICH_TASK_BUDGET_TOKENS,
  }).finally(progress.stop);

  if (result.status === 'nothing-to-fix') {
    banner('NOTHING TO FIX', 'dim', path);
    paragraph('The last verdict named no gaps in the check — there is nothing here to correct.');
    return 0;
  }

  if (result.status === 'refused') {
    banner('REFUSED', 'yellow', path);
    paragraph(result.detail ?? 'could not fix the check.');
    return 2;
  }

  consoleLogger.info(`usage: ${breakdown(llm)}`);
  banner('FIXED', 'green', path, cost(result.effectiveTokens));
  section(
    'Files',
    [{ body: 'The check only. Nothing else in the spec changed.', bullets: result.files }],
    '+',
    'green',
  );
  if (result.report) note(`report: ${result.report}`);
  note(`Read the fix before trusting it: pnpm verify ${target}`);
  return 0;
}

function cost(effectiveTokens: number): string {
  return `${Math.round(effectiveTokens).toLocaleString('en-US')} effective tokens`;
}

function breakdown(llm: ClaudeCodeLlm): string {
  const u = llm.totalUsage;
  return `in ${u.inputTokens} · out ${u.outputTokens} · cache-write ${u.cacheCreationTokens} · cache-read ${u.cacheReadTokens}`;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof QueryFailedError) {
      consoleLogger.error(error.message);
      process.exitCode = 1;
      return;
    }
    if (error instanceof ModelContractError) {
      consoleLogger.error(error.message);
      process.exitCode = 2;
      return;
    }
    if (error instanceof SpecNotFoundError) {
      consoleLogger.error(error.message);
      process.exitCode = 2;
      return;
    }
    if (error instanceof SpecFormatError) {
      consoleLogger.error(`refusing to enrich: ${error.message}`);
      process.exitCode = 2;
      return;
    }
    consoleLogger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });

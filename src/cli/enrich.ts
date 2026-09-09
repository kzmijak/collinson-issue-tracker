import { enrich } from '../spec/enrich.js';
import { ClaudeCodeLlm, QueryFailedError } from '../llm/ClaudeCodeLlm.js';
import { ModelContractError, type EnrichMode } from '../spec/EnrichPrompt.js';
import { resolveSpecPath, SpecNotFoundError } from '../spec/resolveSpecPath.js';
import { SpecFormatError } from '../spec/SpecFile.js';
import { consoleLogger } from './consoleLogger.js';
import { banner, note, paragraph, section } from './report.js';
import { startProgress } from './progress.js';

/**
 * What the model is told it has, so it paces itself and wraps up instead of being truncated at the
 * output ceiling. Output carries a ×10 weight for sonnet-5 in effective tokens, so 45,000 tokens
 * plus the cache overhead measured in `notes/enrich-cost-measurements.md` lands under 500,000 ET.
 *
 * No `maxBudgetUsd`: a hard abort returns nothing usable, so it buys a cheaper failure rather than
 * a cheaper success. Left unset deliberately.
 */
const TASK_BUDGET_TOKENS = 45_000;

const IDENTITY =
  'You expand specifications for collinson-issue-tracker. You are precise, you enumerate, and you ' +
  'ask rather than invent.';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const mode: EnrichMode = args.includes('--no-questions') ? 'no-questions' : 'default';
  const force = args.includes('--force');
  const target = args.find((arg) => !arg.startsWith('--'));

  if (!target) {
    consoleLogger.error(
      'usage: pnpm enrich <spec number, slug, or path to spec.md> [--no-questions] [--force]',
    );
    return 1;
  }

  const path = resolveSpecPath(target);

  const model = 'claude-sonnet-5';
  const llm = new ClaudeCodeLlm(model, IDENTITY, { taskBudgetTokens: TASK_BUDGET_TOKENS });
  const progress = startProgress(`enriching ${path}`);
  const result = await enrich(path, llm, mode, {
    model,
    taskBudgetTokens: TASK_BUDGET_TOKENS,
    force,
  }).finally(progress.stop);

  if (result.status !== 'unchanged') consoleLogger.info(`usage: ${breakdown(llm)}`);

  if (result.status === 'unchanged') {
    banner('UNCHANGED', 'dim', path);
    paragraph(
      'Your section has not changed and the last result was not rejected. What it left you:',
    );

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
  note(`Read the report before the spec: pnpm verify ${target}`);
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

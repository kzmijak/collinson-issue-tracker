import { ClaudeCodeLlm, QueryFailedError } from '../llm/ClaudeCodeLlm.js';
import { ModelContractError } from '../spec/EnrichPrompt.js';
import { resolveSpecPath, SpecNotFoundError } from '../spec/resolveSpecPath.js';
import { verify } from '../spec/verify.js';
import { SpecFormatError } from '../spec/SpecFile.js';
import { consoleLogger } from './consoleLogger.js';
import type { Finding } from '../spec/VerifyPrompt.js';

const asItem = (finding: Finding) => ({
  title: finding.area,
  quote: finding.quote ?? undefined,
  body: finding.problem,
});
import { banner, note, paragraph, section } from './report.js';
import { startProgress } from './progress.js';

const TASK_BUDGET_TOKENS = 30_000;

const IDENTITY =
  'You review specifications for collinson-issue-tracker. You judge whether a spec can be ' +
  'implemented unambiguously and whether its check can fail.';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const strict = args.includes('--strict');
  const target = args.find((arg) => !arg.startsWith('--'));

  if (!target) {
    consoleLogger.error(
      'usage: pnpm verify <spec number, slug, or path to spec.md> [--force] [--strict]',
    );
    return 1;
  }

  const path = resolveSpecPath(target);
  const llm = new ClaudeCodeLlm('claude-sonnet-5', IDENTITY, {
    taskBudgetTokens: TASK_BUDGET_TOKENS,
  });
  const progress = startProgress(`verifying ${path}`);
  const result = await verify(path, llm, force).finally(progress.stop);

  const cost = result.reused
    ? 'unchanged since the last verdict, reused'
    : `${Math.round(result.effectiveTokens).toLocaleString('en-US')} effective tokens`;

  const accepted = result.verdict === 'accepted';
  banner(accepted ? 'ACCEPTED' : 'REJECTED', accepted ? 'green' : 'red', path, cost);
  paragraph(result.summary);

  section('Must fix', result.mustFix.map(asItem), 'x', 'red');
  section('Should fix', result.shouldFix.map(asItem), '-', 'yellow');
  section('Worth knowing', result.shouldKnow.map(asItem), 'i', 'blue');

  if (!result.reused) {
    note(
      result.attachedTo
        ? `recorded in ${result.attachedTo}`
        : 'no enrichment record to attach this to — the spec predates metrics',
    );
  }

  if (result.verdict === 'rejected') {
    note('the lock has dropped — `pnpm enrich` regenerates without --force');
  }
  return strict && result.verdict === 'rejected' ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const known =
      error instanceof ModelContractError ||
      error instanceof SpecNotFoundError ||
      error instanceof SpecFormatError ||
      error instanceof QueryFailedError;
    consoleLogger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = known ? 2 : 1;
  });

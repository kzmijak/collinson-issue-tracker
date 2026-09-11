import { QueryFailedError } from '../llm/ClaudeCodeLlm.js';
import type { EnrichResult } from '../spec/enrich.js';
import { ModelContractError } from '../spec/EnrichPrompt.js';
import { resolveSpecPath, SpecNotFoundError, specName } from '../spec/resolveSpecPath.js';
import type { Finding } from '../spec/schemas/Verdict.js';
import { SpecFormatError } from '../spec/SpecFile.js';
import { StaleEnrichmentError, verify, type VerifyResult } from '../spec/verify.js';
import type { EnrichAccsResult } from '../spec/enrichAccs.js';
import { verifyLoop, type LoopStepKind } from '../spec/verifyLoop.js';
import {
  accsAuthorBorrowsIdentity,
  ACCS_AUTHOR_DEFINITION,
  createAccsAuthor,
  createEnricher,
  createVerifier,
  ENRICH_TASK_BUDGET_TOKENS,
  SPEC_MODEL,
} from './agents.js';
import { numberFlag, positional } from './args.js';
import { consoleLogger } from './consoleLogger.js';
import { effectiveTokens } from './format.js';
import { startProgress } from './progress.js';
import { banner, note, paragraph, section } from './report.js';

const USAGE =
  'usage: pnpm verify <spec number, slug, or path to spec.md> [--force] [--strict] [--loop <turns>]';

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const strict = args.includes('--strict');
  const turns = numberFlag(args, '--loop');
  const target = positional(args, ['--loop']);

  if (!target) {
    consoleLogger.error(USAGE);
    return 1;
  }
  if (args.includes('--loop') && !turns) {
    consoleLogger.error('--loop needs a number of turns, e.g. `--loop 3`');
    return 1;
  }

  const path = resolveSpecPath(target);
  if (turns) return runLoop(path, turns, force);

  const llm = createVerifier();
  const progress = startProgress(`verifying ${specName(path)}`);
  llm.observe(progress.activity);
  const result = await verify(path, llm, force).catch((error: unknown) => {
    progress.stop('failed');
    throw error;
  });
  progress.stop(outcomeOf(result));

  report(result, path);
  if (result.verdict === 'rejected') {
    note(
      result.fix === 'accs'
        ? `only the ACCS has to change — \`pnpm enrich:accs ${target}\` repairs it and leaves the enriched spec alone`
        : `the enriched spec has to change — \`pnpm enrich ${target}\` regenerates it and the ACCS`,
    );
  }
  return strict && result.verdict === 'rejected' ? 1 : 0;
}

async function runLoop(path: string, maxTurns: number, force: boolean): Promise<number> {
  const enricher = createEnricher();
  const accsAuthor = createAccsAuthor();
  const verifier = createVerifier();
  if (accsAuthorBorrowsIdentity()) {
    note(
      `${ACCS_AUTHOR_DEFINITION} does not exist yet — the ACCS author borrows the enricher's identity.`,
    );
  }

  const result = await verifyLoop(
    path,
    { enricher, accsAuthor, verifier },
    {
      maxTurns,
      force,
      enrich: { model: SPEC_MODEL, taskBudgetTokens: ENRICH_TASK_BUDGET_TOKENS },
      around: async (turn, kind, work) => {
        const progress = startProgress(
          `turn ${turn}/${maxTurns} · ${VERBS[kind]} ${specName(path)}`,
        );
        for (const agent of AGENTS_BY_STEP[kind]({ enricher, accsAuthor, verifier })) {
          agent.observe(progress.activity);
        }
        try {
          const outcome = await work();
          progress.stop(outcomeOf(outcome as EnrichResult | EnrichAccsResult | VerifyResult));
          return outcome;
        } catch (error) {
          progress.stop('failed');
          throw error;
        }
      },
      onStep: (step) => {
        if (step.kind === 'verify') {
          report(step.result, `turn ${step.turn}/${maxTurns}`);
          return;
        }
        if (step.result.status === 'blocked') {
          section(
            'Needs a decision',
            step.result.blocking.map((question) => ({ body: question })),
            '?',
            'red',
          );
        }
      },
    },
  );

  const summary = `${result.turns} turn${result.turns === 1 ? '' : 's'} · ${effectiveTokens(result.effectiveTokens)}`;

  if (result.status === 'approved') {
    banner('APPROVED', 'green', path, summary);
    return 0;
  }
  if (result.status === 'blocked') {
    banner('BLOCKED', 'red', path, summary);
    note('Append a dated entry under `## What I want` that settles these, then run again.');
    return 1;
  }
  banner('OUT OF TURNS', 'red', path, summary);
  note(
    'Still rejected. The last verdict is above — append an entry, or run again with more turns.',
  );
  return 1;
}

const VERBS: Record<LoopStepKind, string> = {
  enrich: 'enriching',
  'fix-accs': 'fixing the ACCS of',
  verify: 'verifying',
};

type Agents = Record<'enricher' | 'accsAuthor' | 'verifier', ReturnType<typeof createVerifier>>;

const AGENTS_BY_STEP: Record<LoopStepKind, (agents: Agents) => Agents[keyof Agents][]> = {
  enrich: (agents) => [agents.enricher, agents.accsAuthor],
  'fix-accs': (agents) => [agents.accsAuthor],
  verify: (agents) => [agents.verifier],
};

function outcomeOf(result: EnrichResult | EnrichAccsResult | VerifyResult): string {
  if ('verdict' in result) {
    const verdict = result.reused ? `${result.verdict}, reused` : result.verdict;
    return result.verdict === 'rejected' ? `${verdict} — next: redo the ${result.fix}` : verdict;
  }
  return result.status;
}

function report(result: VerifyResult, subject: string): void {
  const cost = result.reused
    ? 'unchanged since the last verdict, reused'
    : effectiveTokens(result.effectiveTokens);
  const approved = result.verdict === 'approved';

  banner(approved ? 'APPROVED' : 'REJECTED', approved ? 'green' : 'red', subject, cost);
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
}

function asItem(finding: Finding) {
  return { title: finding.area, quote: finding.quote ?? undefined, body: finding.problem };
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
      error instanceof QueryFailedError ||
      error instanceof StaleEnrichmentError;
    consoleLogger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = known ? 2 : 1;
  });

import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import {
  EffectiveTokenCeilingError,
  type Activity,
  type Llm,
  type TokenUsage,
} from '../llm/Llm.js';
import { budgetTokens, MIN_ROUND_EFFECTIVE_TOKENS } from './budget.js';
import { readAgentPrompt } from './agentPrompt.js';
import { ApplyPrompt, ReapplyPrompt } from './ApplyPrompt.js';
import type { Implementation } from './schemas/Implementation.js';
import { readKnowledgeBase } from './knowledgeBase.js';
import { amendMetrics } from './metrics.js';
import { readArtefacts } from './readArtefacts.js';
import { runCheck, type CheckResult } from './runCheck.js';
import { readStatus, setStatus, specSha } from './SpecFile.js';
import { readPreviousFiles } from './specFiles.js';
import { describeSpec, isStale, readSpecFolder } from './specFolder.js';
import { applyReport, writeReport } from './reports.js';
import { specName } from './resolveSpecPath.js';

export const IMPLEMENTER_DEFINITION = '.ai/identities/implementer.md';

export type ApplyStatus =
  | 'converged'
  | 'not-converged'
  | 'nothing-to-do'
  | 'blocked'
  | 'refused'
  | 'budget-exhausted'
  | 'time-exhausted';

export interface ApplyProps {
  model: string;
  /** The ceiling for the whole run, in effective tokens. Rounds share it; they do not each get it. */
  effectiveTokenBudget: number;
  /** Hard stop for the whole run, in effective tokens: a round that passes it is aborted. */
  hardEffectiveTokenLimit?: number;
  rounds: number;
  checkTimeoutMs: number;
  /** No new round starts after this; a round already running is never cut off, so its spend is still counted. */
  timeLimitMs: number;
  force: boolean;
  /** What the acceptance check runs with — the same environment the implementer had. */
  checkEnv?: NodeJS.ProcessEnv;
  /** Reports as the run goes, so minutes of silence are not the only feedback available. */
  onActivity?: (activity: Activity) => void;
}

export interface ApplyResult {
  status: ApplyStatus;
  rounds: number;
  check: CheckResult | null;
  implementation: Implementation | null;
  effectiveTokens: number;
  usage: TokenUsage;
  attachedTo: string | null;
  detail?: string;
  report?: string;
}

/**
 * The acceptance check is also the plan step: green means there is nothing to do, red means there
 * is. Every refusal below happens before the first token is spent, because the cheapest run is the
 * one that establishes it should not happen.
 */
export async function apply(path: string, llm: Llm, props: ApplyProps): Promise<ApplyResult> {
  const startedAt = Date.now();
  const folder = await readSpecFolder(path);
  const { output } = folder.paths;
  const verdict = readStatus(folder.enriched);

  if (isStale(folder) && !props.force) {
    return refused(
      'spec.md or accs.md changed since the spec was enriched and approved — run `pnpm enrich` ' +
        'and `pnpm verify` first, or `--force`.',
    );
  }

  if (verdict !== 'approved' && !props.force) {
    return refused(
      `the spec's status is "${verdict}", not "approved" — implementing one the verifier has not ` +
        'passed is how a rejected decision reaches the code. Run `pnpm verify` first, or `--force`.',
    );
  }

  const script = folder.paths.accsScript;
  if (!existsSync(script)) {
    return refused(`${script} does not exist — there is no acceptance check to converge on.`);
  }

  const stage = (label: string) => props.onActivity?.({ kind: 'stage', label });

  stage('running the check to see whether there is anything to do');
  const before = await runCheck(script, props.checkTimeoutMs, props.checkEnv);

  if (before.exitCode === 0) {
    return { ...empty(), status: 'nothing-to-do', check: before };
  }

  const instructions = readAgentPrompt(IMPLEMENTER_DEFINITION, { without: ['Output format'] });
  const artefacts = await readArtefacts(output, readPreviousFiles(folder.enriched));
  const knowledge = await readKnowledgeBase();

  let check = before;
  let implementation: Implementation | null = null;
  let effectiveTokens = 0;
  let round = 0;
  let exhausted = false;
  let outOfTime = false;

  while (round < props.rounds) {
    const remaining = props.effectiveTokenBudget - effectiveTokens;

    // Each round's budget is what the ceiling has left, not a fresh allowance — three rounds of a
    // full budget is three times the ceiling the operator set.
    if (remaining < MIN_ROUND_EFFECTIVE_TOKENS && round > 0) {
      exhausted = true;
      break;
    }
    if (round > 0 && Date.now() - startedAt >= props.timeLimitMs) {
      outOfTime = true;
      break;
    }
    round += 1;

    const prompt =
      round === 1
        ? new ApplyPrompt({
            spec: describeSpec(folder),
            artefacts,
            knowledge,
            instructions,
            script,
          })
        : new ReapplyPrompt(check, round, props.rounds);

    const allowance = budgetTokens(remaining, props.model);
    stage(
      `round ${round} of ${props.rounds} — implementing, ${Math.round(remaining).toLocaleString('en-US')} effective tokens left`,
    );
    try {
      implementation = await llm.prompt(prompt, {
        fresh: round === 1,
        onActivity: props.onActivity,
        taskBudgetTokens: allowance,
        ...(props.hardEffectiveTokenLimit !== undefined && {
          maxEffectiveTokens: props.hardEffectiveTokenLimit - effectiveTokens,
        }),
      });
    } catch (error) {
      if (!(error instanceof EffectiveTokenCeilingError)) throw error;
      effectiveTokens += llm.lastEffectiveTokens;
      stage(`round ${round} — aborted at the hard limit, running the check`);
      check = await runCheck(script, props.checkTimeoutMs, props.checkEnv);
      // A run cut off mid-sentence may still have finished the work — the check, not the ledger,
      // decides that.
      exhausted = check.exitCode !== 0;
      break;
    }
    effectiveTokens += llm.lastEffectiveTokens;

    if (implementation.blocked) break;

    stage(`round ${round} — running the check`);
    check = await runCheck(script, props.checkTimeoutMs, props.checkEnv);
    stage(
      check.exitCode === 0
        ? `check passed in ${Math.round(check.durationMs / 1000)}s`
        : `check failed in ${Math.round(check.durationMs / 1000)}s (exit ${check.exitCode})`,
    );

    if (check.exitCode === 0) break;
  }

  const status = exhausted
    ? 'budget-exhausted'
    : outOfTime
      ? 'time-exhausted'
      : settle(implementation, check);
  const sha = specSha(folder.operatorSection, folder.accs, folder.enriched, artefacts);
  const sentBack = (implementation?.fix ?? 'none') !== 'none' ? implementation : null;

  // Sent back the way a verifier would send it: the enrichment reads the findings, the loop reads
  // the range of fire, and apply refuses the spec until it has been enriched and approved again.
  if (sentBack) {
    await writeFile(folder.paths.enriched, setStatus(folder.enriched, 'rejected'), 'utf8');
  }
  const attachedTo = await amendMetrics(output, {
    ...(sentBack && {
      verification: {
        at: new Date().toISOString(),
        verdict: 'rejected',
        summary: sentBack.summary,
        mustFix: sentBack.findings,
        shouldFix: [],
        shouldKnow: [],
        fix: sentBack.fix === 'accs' ? 'accs' : 'full',
        by: 'implementer',
        effectiveTokens: 0,
        specSha: sha,
      },
    }),
    application: {
      at: new Date().toISOString(),
      status,
      rounds: round,
      checkExitCode: check.exitCode,
      checkDurationMs: check.durationMs,
      converged: status === 'converged',
      summary: implementation?.summary ?? null,
      files: implementation?.files ?? [],
      picks: implementation?.picks ?? [],
      findings: implementation?.findings ?? [],
      fix: implementation?.fix ?? 'none',
      blocked: implementation?.blocked ?? null,
      effectiveTokens,
      effectiveTokenBudget: props.effectiveTokenBudget,
      withinBudget: effectiveTokens <= props.effectiveTokenBudget,
      usage: llm.totalUsage,
      model: props.model,
      specSha: sha,
    },
  });

  const report = await writeReport(
    output,
    'apply',
    new Date().toISOString(),
    applyReport(
      {
        spec: specName(path),
        at: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        effectiveTokens,
      },
      { status, rounds: round, implementation },
    ),
  );

  return {
    status,
    rounds: round,
    check,
    implementation,
    effectiveTokens,
    usage: llm.totalUsage,
    attachedTo,
    report,
  };
}

function settle(implementation: Implementation | null, check: CheckResult): ApplyStatus {
  if (implementation?.blocked) return 'blocked';
  if (check.exitCode === 0) return 'converged';
  return 'not-converged';
}

function empty(): ApplyResult {
  return {
    status: 'refused',
    rounds: 0,
    check: null,
    implementation: null,
    effectiveTokens: 0,
    usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
    attachedTo: null,
  };
}

function refused(detail: string): ApplyResult {
  return { ...empty(), detail };
}

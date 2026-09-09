import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Activity, Llm, TokenUsage } from '../llm/Llm.js';
import { budgetTokens, MIN_ROUND_EFFECTIVE_TOKENS } from './budget.js';
import { readAgentPrompt } from './agentPrompt.js';
import { ApplyPrompt, ReapplyPrompt, type Implementation } from './ApplyPrompt.js';
import { readKnowledgeBase } from './knowledgeBase.js';
import { amendMetrics } from './metrics.js';
import { readArtefacts } from './readArtefacts.js';
import { COULD_NOT_RUN, runCheck, type CheckResult } from './runCheck.js';
import { readStatus, specSha, splitSpec } from './SpecFile.js';
import { TEST_SCRIPT } from './specFiles.js';

export const IMPLEMENTER_DEFINITION = '.claude/agents/spec-implementer.md';

export type ApplyStatus =
  | 'converged'
  | 'not-converged'
  | 'nothing-to-do'
  | 'blocked'
  | 'refused'
  | 'check-unrunnable'
  | 'budget-exhausted';

export interface ApplyProps {
  model: string;
  /** The ceiling for the whole run, in effective tokens. Rounds share it; they do not each get it. */
  effectiveTokenBudget: number;
  rounds: number;
  checkTimeoutMs: number;
  force: boolean;
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
}

/**
 * The acceptance check is also the plan step: green means there is nothing to do, red means there
 * is. Every refusal below happens before the first token is spent, because the cheapest run is the
 * one that establishes it should not happen.
 */
export async function apply(path: string, llm: Llm, props: ApplyProps): Promise<ApplyResult> {
  const specDir = dirname(path);
  const source = await readFile(path, 'utf8');
  const { generated } = splitSpec(source);
  const verdict = readStatus(generated);

  if (verdict !== 'accepted' && !props.force) {
    return refused(
      `the spec's status is "${verdict}", not "accepted" — implementing one the verifier has not ` +
        'passed is how a rejected decision reaches the code. Run `pnpm verify` first, or `--force`.',
    );
  }

  const script = join(specDir, TEST_SCRIPT);
  if (!existsSync(script)) {
    return refused(`${script} does not exist — there is no acceptance check to converge on.`);
  }

  const stage = (label: string) => props.onActivity?.({ kind: 'stage', label });

  stage('running the check to see whether there is anything to do');
  const before = await runCheck(script, props.checkTimeoutMs);

  if (before.exitCode === 0) {
    return { ...empty(), status: 'nothing-to-do', check: before };
  }
  if (before.exitCode === COULD_NOT_RUN) {
    return {
      ...empty(),
      status: 'check-unrunnable',
      check: before,
      detail: before.timedOut
        ? `the check did not finish within ${props.checkTimeoutMs / 1000}s, so it has not judged ` +
          'anything. Nothing was spent.'
        : 'the check reported that it could not run here, which is not a failing implementation.',
    };
  }

  const instructions = readAgentPrompt(IMPLEMENTER_DEFINITION, { without: ['Output format'] });
  const artefacts = await readArtefacts(specDir);
  const knowledge = await readKnowledgeBase();

  let check = before;
  let implementation: Implementation | null = null;
  let effectiveTokens = 0;
  let round = 0;
  let exhausted = false;

  while (round < props.rounds) {
    const remaining = props.effectiveTokenBudget - effectiveTokens;

    // Each round's budget is what the ceiling has left, not a fresh allowance — three rounds of a
    // full budget is three times the ceiling the operator set.
    if (remaining < MIN_ROUND_EFFECTIVE_TOKENS && round > 0) {
      exhausted = true;
      break;
    }
    round += 1;

    const prompt =
      round === 1
        ? new ApplyPrompt({ spec: source, artefacts, knowledge, instructions, script })
        : new ReapplyPrompt(check, round, props.rounds);

    const allowance = budgetTokens(remaining, props.model);
    stage(
      `round ${round} of ${props.rounds} — implementing, ${Math.round(remaining).toLocaleString('en-US')} effective tokens left`,
    );
    implementation = await llm.prompt(prompt, {
      fresh: round === 1,
      onActivity: props.onActivity,
      taskBudgetTokens: allowance,
    });
    effectiveTokens += llm.lastEffectiveTokens;

    if (implementation.blocked) break;

    stage(`round ${round} — running the check`);
    check = await runCheck(script, props.checkTimeoutMs);
    stage(
      check.exitCode === 0
        ? `check passed in ${Math.round(check.durationMs / 1000)}s`
        : `check failed in ${Math.round(check.durationMs / 1000)}s (exit ${check.exitCode})`,
    );

    if (check.exitCode === 0 || check.exitCode === COULD_NOT_RUN) break;
  }

  const status = exhausted ? 'budget-exhausted' : settle(implementation, check);
  const attachedTo = await amendMetrics(specDir, {
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
      blocked: implementation?.blocked ?? null,
      effectiveTokens,
      effectiveTokenBudget: props.effectiveTokenBudget,
      withinBudget: effectiveTokens <= props.effectiveTokenBudget,
      usage: llm.totalUsage,
      model: props.model,
      specSha: specSha(source),
    },
  });

  return {
    status,
    rounds: round,
    check,
    implementation,
    effectiveTokens,
    usage: llm.totalUsage,
    attachedTo,
  };
}

function settle(implementation: Implementation | null, check: CheckResult): ApplyStatus {
  if (implementation?.blocked) return 'blocked';
  if (check.exitCode === 0) return 'converged';
  if (check.exitCode === COULD_NOT_RUN) return 'check-unrunnable';
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

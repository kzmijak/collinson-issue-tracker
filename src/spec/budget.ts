import { MODEL_COST } from '../llm/ClaudeCodeLlm.js';

/**
 * Effective tokens are the unit the operator sets a ceiling in, but `taskBudget` is denominated in
 * plain tokens, so a ceiling has to be converted before it can be handed to a model.
 *
 * The conversion is a measurement we do not have yet for implementation runs, so it is a model, and
 * this is the model: for every token of output a file-editing run produces, it re-reads roughly
 * fifteen tokens of cached context and writes half a token of new cache. Weighted by the effective
 * token formula that is 1×5 + 15×0.1 + 0.5×1.25 = 7.125 per output token, before the model's own
 * multiplier.
 *
 * It will be wrong. `Application.usage` now records what a run actually spent, so the second run
 * replaces this arithmetic with a number.
 */
export const WEIGHTED_ET_PER_OUTPUT_TOKEN = 7.125;

/** Below this there is no point starting a round: it cannot finish anything. */
export const MIN_ROUND_EFFECTIVE_TOKENS = 50_000;

export function budgetTokens(remainingEffectiveTokens: number, model: string): number {
  const perToken = WEIGHTED_ET_PER_OUTPUT_TOKEN * (MODEL_COST[model] ?? 1);

  return Math.max(0, Math.floor(remainingEffectiveTokens / perToken));
}

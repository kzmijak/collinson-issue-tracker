import { MODEL_COST } from '../llm/ClaudeCodeLlm.js';

/**
 * Effective tokens are the unit the operator sets a ceiling in, but `taskBudget` is denominated in
 * plain tokens, so a ceiling has to be converted before it can be handed to a model.
 *
 * `taskBudget` counts what the model generates and the tool results it reads in, not the cached
 * history it re-reads every turn — and that history is most of the bill. Measured on the 2026-09-11
 * apply of spec 001 (sonnet-5): 495,258 effective tokens for 64,462 budget tokens (9,827 output +
 * 54,635 cache creation), 7.68 per budget token, 3.84 before the model's multiplier.
 */
export const WEIGHTED_ET_PER_BUDGET_TOKEN = 3.84;

/** Below this there is no point starting a round: it cannot finish anything. */
export const MIN_ROUND_EFFECTIVE_TOKENS = 50_000;

export function budgetTokens(remainingEffectiveTokens: number, model: string): number {
  const perToken = WEIGHTED_ET_PER_BUDGET_TOKEN * (MODEL_COST[model] ?? 1);

  return Math.max(0, Math.floor(remainingEffectiveTokens / perToken));
}

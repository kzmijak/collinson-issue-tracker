import { existsSync } from 'node:fs';
import { ClaudeCodeLlm } from '../llm/ClaudeCodeLlm.js';
import { PROJECT_CONTEXT, readAgentPrompt } from '../spec/agentPrompt.js';
import { REVIEWER_DEFINITION } from '../spec/verify.js';

export const ENRICHER_DEFINITION = '.ai/identities/enricher.md';
export const ACCS_AUTHOR_DEFINITION = '.ai/identities/accs-author.md';

export const SPEC_MODEL = 'claude-sonnet-5';

/**
 * What the model is told it has, so it paces itself and wraps up instead of being truncated at the
 * output ceiling. Output carries a ×10 weight for sonnet-5 in effective tokens, so 45,000 tokens
 * plus the cache overhead measured in `docs/enrich-cost-measurements.md` lands under 200,000 ET.
 *
 * No `maxBudgetUsd`: a hard abort returns nothing usable, so it buys a cheaper failure rather than
 * a cheaper success. Left unset deliberately.
 */
export const ENRICH_TASK_BUDGET_TOKENS = 45_000;

const VERIFY_TASK_BUDGET_TOKENS = 60_000;

export function createEnricher(): ClaudeCodeLlm {
  const llm = new ClaudeCodeLlm(SPEC_MODEL, readAgentPrompt(ENRICHER_DEFINITION), {
    taskBudgetTokens: ENRICH_TASK_BUDGET_TOKENS,
  });
  llm.updateSystemPrompt({ rules: readAgentPrompt(PROJECT_CONTEXT) });
  return llm;
}

/** Until the operator writes the ACCS author's own identity, it borrows the enricher's. */
export function accsAuthorBorrowsIdentity(): boolean {
  return !existsSync(ACCS_AUTHOR_DEFINITION);
}

export function createAccsAuthor(): ClaudeCodeLlm {
  const identity = accsAuthorBorrowsIdentity() ? ENRICHER_DEFINITION : ACCS_AUTHOR_DEFINITION;
  const llm = new ClaudeCodeLlm(SPEC_MODEL, readAgentPrompt(identity), {
    taskBudgetTokens: ENRICH_TASK_BUDGET_TOKENS,
  });
  llm.updateSystemPrompt({ rules: readAgentPrompt(PROJECT_CONTEXT) });
  return llm;
}

export function createVerifier(): ClaudeCodeLlm {
  const identity = readAgentPrompt(REVIEWER_DEFINITION, { without: ['Output format'] });
  const llm = new ClaudeCodeLlm(SPEC_MODEL, identity, {
    taskBudgetTokens: VERIFY_TASK_BUDGET_TOKENS,
  });
  llm.updateSystemPrompt({ rules: readAgentPrompt(PROJECT_CONTEXT) });
  return llm;
}

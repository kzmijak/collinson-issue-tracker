import { describe, expect, it } from 'vitest';
import {
  budgetTokens,
  WEIGHTED_ET_PER_OUTPUT_TOKEN,
} from '../../../src/sdd-framework/spec/budget.js';

describe('budgetTokens', () => {
  it('converts an effective-token ceiling into the plain tokens taskBudget expects', () => {
    expect(budgetTokens(800_000, 'claude-sonnet-5')).toBe(
      Math.floor(800_000 / (WEIGHTED_ET_PER_OUTPUT_TOKEN * 2)),
    );
  });

  it('gives a dearer model proportionally fewer tokens for the same ceiling', () => {
    expect(budgetTokens(800_000, 'claude-opus-5')).toBeLessThan(
      budgetTokens(800_000, 'claude-sonnet-5'),
    );
  });

  it('never returns a negative allowance once the ceiling is spent', () => {
    expect(budgetTokens(-1_000, 'claude-sonnet-5')).toBe(0);
  });
});

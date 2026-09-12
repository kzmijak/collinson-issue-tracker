import { describe, expect, it } from 'vitest';
import {
  accuracyFromPenalty,
  effortAccuracy,
  penaltyFor,
  priorityAccuracy,
  WORST_PENALTY,
} from '../../src/harness/scoring.js';

describe('penaltyFor', () => {
  it('is 0 for a perfect answer on both axes', () => {
    expect(penaltyFor(3, 2, 3, 2)).toBe(0);
  });

  it('is 38 for the worst possible answer', () => {
    expect(penaltyFor(0, 0, 5, 3)).toBe(WORST_PENALTY);
  });

  it('combines 2^|priorityGap| and 2^|effortGap|, minus 2', () => {
    expect(penaltyFor(5, 3, 4, 2)).toBe(2 ** 1 + 2 ** 1 - 2);
  });
});

describe('accuracyFromPenalty', () => {
  it('is 1 for a zero penalty', () => {
    expect(accuracyFromPenalty(0)).toBe(1);
  });

  it('is 0 for the worst penalty', () => {
    expect(accuracyFromPenalty(WORST_PENALTY)).toBe(0);
  });
});

describe('priorityAccuracy and effortAccuracy', () => {
  it('are 1 when the axis matches exactly', () => {
    expect(priorityAccuracy(4, 4)).toBe(1);
    expect(effortAccuracy(2, 2)).toBe(1);
  });

  it('are 0 at the widest possible gap for that axis', () => {
    expect(priorityAccuracy(0, 5)).toBe(0);
    expect(effortAccuracy(0, 3)).toBe(0);
  });
});

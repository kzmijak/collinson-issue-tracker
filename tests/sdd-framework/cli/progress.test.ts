import { describe, expect, it } from 'vitest';
import { UsageTally } from '../../../src/sdd-framework/cli/progress.js';

describe('UsageTally', () => {
  it('adds each finished call exactly and the running one on top', () => {
    const tally = new UsageTally();

    tally.add({ kind: 'usage', effectiveTokens: 500, estimated: true, final: false });
    expect(tally.describe()).toBe('~500 ET');

    tally.add({ kind: 'usage', effectiveTokens: 600, estimated: false, final: true });
    expect(tally.describe()).toBe('600 ET');

    tally.add({ kind: 'usage', effectiveTokens: 100, estimated: true, final: false });
    expect(tally.total).toBe(700);
    expect(tally.describe()).toBe('~700 ET');
  });

  it('ignores activity that is not usage', () => {
    const tally = new UsageTally();
    tally.add({ kind: 'stage', label: 'round 1' });

    expect(tally.total).toBe(0);
  });
});

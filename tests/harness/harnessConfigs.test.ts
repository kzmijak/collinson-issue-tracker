import { describe, expect, it } from 'vitest';
import { harnessConfigName } from '../../src/harness/harnessConfigs.js';

describe('harnessConfigName', () => {
  it('formats as model-effort-thinking, thinking rendered on/off', () => {
    expect(
      harnessConfigName({ model: 'claude-haiku-4-5', effort: 'medium', thinking: false }),
    ).toBe('claude-haiku-4-5-medium-off');
    expect(harnessConfigName({ model: 'claude-sonnet-5', effort: 'medium', thinking: true })).toBe(
      'claude-sonnet-5-medium-on',
    );
  });
});

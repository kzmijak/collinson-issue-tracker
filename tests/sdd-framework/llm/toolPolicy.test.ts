import { describe, expect, it } from 'vitest';
import { toolPolicy } from '../../../src/sdd-framework/llm/ClaudeCodeLlm.js';

describe('toolPolicy', () => {
  it('spells out a denial of every tool when the call is meant to have none', () => {
    const policy = toolPolicy([], []);

    expect(policy.allowedTools).toEqual([]);
    expect(policy.disallowedTools).toContain('Bash');
    expect(policy.disallowedTools).toContain('Read');
  });

  it('omits the allow list entirely for an unrestricted call, never passing it empty', () => {
    const policy = toolPolicy('all', ['Bash(git commit:*)']);

    expect(policy.allowedTools).toBeUndefined();
    expect(policy.disallowedTools).toEqual(['Bash(git commit:*)']);
  });

  it('passes an explicit list through with its denials', () => {
    const policy = toolPolicy(['Read', 'Grep'], ['Task']);

    expect(policy.allowedTools).toEqual(['Read', 'Grep']);
    expect(policy.disallowedTools).toEqual(['Task']);
  });
});

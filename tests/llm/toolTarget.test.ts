import { describe, expect, it } from 'vitest';
import { toolTarget } from '../../src/llm/ClaudeCodeLlm.js';

describe('toolTarget', () => {
  it('prefers the file a tool is editing', () => {
    expect(toolTarget({ file_path: 'src/reader/main.ts', old_string: 'a' })).toBe(
      'src/reader/main.ts',
    );
  });

  it('falls back to the command a shell tool is running', () => {
    expect(toolTarget({ command: 'bash specs/001/test.bash' })).toBe('bash specs/001/test.bash');
  });

  it('collapses newlines, so a multi-line command stays one line', () => {
    expect(toolTarget({ command: 'one\n  two' })).toBe('one two');
  });

  it('is empty for a tool whose input names nothing', () => {
    expect(toolTarget({ todos: [] })).toBe('');
    expect(toolTarget(null)).toBe('');
    expect(toolTarget(undefined)).toBe('');
  });
});

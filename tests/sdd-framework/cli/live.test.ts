import { describe, expect, it } from 'vitest';
import { describe as line } from '../../../src/sdd-framework/cli/live.js';

describe('describe', () => {
  it('names the tool and what it is acting on', () => {
    expect(line({ kind: 'tool', name: 'Edit', target: 'src/reader/statusBar.ts' })).toContain(
      'Edit',
    );
    expect(line({ kind: 'tool', name: 'Edit', target: 'src/reader/statusBar.ts' })).toContain(
      'src/reader/statusBar.ts',
    );
  });

  it('survives a tool call with nothing nameable in it', () => {
    expect(line({ kind: 'tool', name: 'TodoWrite', target: '' })).toContain('TodoWrite');
  });

  it('keeps narration to its first line', () => {
    const result = line({ kind: 'text', text: 'first line\nsecond line' });

    expect(result).toContain('first line');
    expect(result).not.toContain('second line');
  });

  it('drops narration that is only whitespace', () => {
    expect(line({ kind: 'text', text: '  \n\n ' })).toBeNull();
  });

  it('clips a long line rather than wrapping the status display', () => {
    const result = line({ kind: 'tool', name: 'Bash', target: 'x'.repeat(400) }) ?? '';

    expect(result.length).toBeLessThan(200);
    expect(result).toContain('…');
  });
});

describe('brief', () => {
  it('keeps the first sentences and drops the essay', async () => {
    const { brief } = await import('../../../src/sdd-framework/cli/report.js');
    const result = brief('One. Two. Three. Four. Five.');

    expect(result).toBe('One. Two. Three.');
  });

  it('clips a single runaway sentence rather than printing all of it', async () => {
    const { brief } = await import('../../../src/sdd-framework/cli/report.js');
    const result = brief(`${'word '.repeat(400)}end.`);

    expect(result.length).toBeLessThan(430);
    expect(result.endsWith('…')).toBe(true);
  });
});

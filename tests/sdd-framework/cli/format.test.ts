import { describe, expect, it } from 'vitest';
import { fitLine, inline, wrap } from '../../../src/sdd-framework/cli/format.js';

describe('inline', () => {
  it('renders bold rather than leaving asterisks in front of the operator', () => {
    const result = inline('**What are the env var names?** GITHUB_REPO');

    expect(result).not.toContain('**');
    expect(result).toContain('What are the env var names?');
  });

  it('marks code spans', () => {
    expect(inline('pass `--force` to regenerate')).not.toContain('`');
  });

  it('leaves plain text alone', () => {
    expect(inline('nothing to do here')).toBe('nothing to do here');
  });
});

describe('wrap', () => {
  it('measures visible width, so styling does not shorten the line', () => {
    const words = 'word '.repeat(40).trim();

    expect(wrap(`**${words}**`, 6)).toHaveLength(wrap(words, 6).length);
  });

  it('never breaks mid-word', () => {
    for (const line of wrap('supercalifragilistic '.repeat(10).trim(), 6)) {
      expect(line).not.toMatch(/supercalifragilisti$/);
    }
  });
});

describe('fitLine', () => {
  const tail = '...  4s · ~27,445 ET';

  it('leaves a line that fits alone', () => {
    expect(fitLine('verifying 001', tail, 80)).toBe(`verifying 001${tail}`);
  });

  it('shortens the label in the middle so the counters and the spec name survive', () => {
    const line = fitLine(
      'turn 1/3 · enriching specs/001-prototype-issues-reader/spec.md',
      tail,
      61,
    );

    expect(line).toHaveLength(60);
    expect(line.endsWith(tail)).toBe(true);
    expect(line.startsWith('turn 1/3')).toBe(true);
    expect(line).toContain('…');
    expect(line).toContain('spec.md');
  });
});

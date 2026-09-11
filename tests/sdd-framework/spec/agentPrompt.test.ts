import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readAgentPrompt } from '../../../src/sdd-framework/spec/agentPrompt.js';

function write(body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'agent-')), 'agent.md');
  writeFileSync(path, body);
  return path;
}

describe('readAgentPrompt', () => {
  it('strips the frontmatter', () => {
    const path = write('---\nname: x\n---\n\n# Body\n\nkeep me');
    expect(readAgentPrompt(path)).toBe('# Body\n\nkeep me');
  });

  it('drops a named section and everything under it', () => {
    const path = write('## Rules\n\nkeep\n\n## Output format\n\ndrop me');
    expect(readAgentPrompt(path, { without: ['Output format'] })).toBe('## Rules\n\nkeep');
  });

  it('does not mistake a heading inside a fenced block for the next section', () => {
    const path = write(
      '## Output format\n\n```\n## Verdict: PASS\n- item\n```\n\n## Rules\n\nkeep',
    );
    const result = readAgentPrompt(path, { without: ['Output format'] });

    expect(result).toBe('## Rules\n\nkeep');
    expect(result).not.toContain('Verdict');
  });

  it('leaves the text alone when the section is absent', () => {
    const path = write('## Rules\n\nkeep');
    expect(readAgentPrompt(path, { without: ['Nothing here'] })).toBe('## Rules\n\nkeep');
  });
});

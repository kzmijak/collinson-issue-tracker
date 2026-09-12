import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readExports } from '../../../src/sdd-framework/spec/exports.js';

const ROW = '| mock port | MOCK_GITHUB_PORT, default 4000 | the check has to find it |';

function spec(specsDir: string, name: string, status: string, rows = ROW): string {
  const dir = join(specsDir, name);
  mkdirSync(join(dir, 'output'), { recursive: true });
  writeFileSync(
    join(dir, 'output', 'enriched-spec.md'),
    [
      '<!-- enrich:meta',
      'source-sha: abc',
      `status: ${status}`,
      '-->',
      '',
      '## Exports',
      '',
      'What later specs have to honour.',
      '',
      '| name | value | why |',
      '| ---- | ----- | --- |',
      rows,
      '',
      '## Done when',
      '',
      '- something else entirely',
      '',
    ].join('\n'),
    'utf8',
  );
  return dir;
}

describe('readExports', () => {
  it('carries the approved specs’ decisions, each under its own spec', async () => {
    const specs = mkdtempSync(join(tmpdir(), 'specs-'));
    spec(specs, '001-reader', 'approved');
    const current = spec(specs, '003-classifier', 'draft');

    const text = await readExports(specs, current);

    expect(text).toContain('### 001-reader');
    expect(text).toContain('MOCK_GITHUB_PORT, default 4000');
    expect(text).not.toContain('something else entirely');
  });

  it('ignores a spec nobody has verified, and the spec being enriched', async () => {
    const specs = mkdtempSync(join(tmpdir(), 'specs-'));
    spec(specs, '002-proposal', 'draft', '| tracker command | pnpm issues-tracker | proposed |');
    const current = spec(specs, '003-classifier', 'approved');

    expect(await readExports(specs, current)).toBe('');
  });
});

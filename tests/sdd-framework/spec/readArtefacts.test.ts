import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readArtefacts } from '../../../src/sdd-framework/spec/readArtefacts.js';

describe('readArtefacts', () => {
  it('reads the whole ACCS suite, nested files included, but not the tool’s own files', async () => {
    const output = mkdtempSync(join(tmpdir(), 'output-'));
    mkdirSync(join(output, 'suite'), { recursive: true });
    mkdirSync(join(output, 'metrics'), { recursive: true });
    writeFileSync(join(output, 'accs.bash'), 'node suite/check.mjs');
    writeFileSync(join(output, 'suite', 'check.mjs'), 'export {};');
    writeFileSync(join(output, 'enriched-spec.md'), 'the spec');
    writeFileSync(join(output, 'metrics', 'run.json'), '{}');

    const text = await readArtefacts(output);

    expect(text).toContain('### accs.bash');
    expect(text).toContain('### suite/check.mjs');
    expect(text).not.toContain('the spec');
    expect(text).not.toContain('run.json');
  });
});

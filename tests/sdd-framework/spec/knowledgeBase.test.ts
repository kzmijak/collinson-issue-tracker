import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readKnowledgeBase } from '../../../src/sdd-framework/spec/knowledgeBase.js';

describe('readKnowledgeBase', () => {
  it('is empty when the directory does not exist, which is the normal state', async () => {
    expect(await readKnowledgeBase(join(tmpdir(), 'no-such-knowledge-dir'))).toBe('');
  });

  it('reads markdown documents in name order, headed by their filename', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kb-'));
    writeFileSync(join(dir, 'b-second.md'), 'second body', 'utf8');
    writeFileSync(join(dir, 'a-first.md'), 'first body', 'utf8');

    const result = await readKnowledgeBase(dir);

    expect(result.indexOf('a-first.md')).toBeLessThan(result.indexOf('b-second.md'));
    expect(result).toContain('first body');
  });

  it('ignores anything that is not markdown, and empty documents', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'kb-'));
    writeFileSync(join(dir, 'notes.txt'), 'not markdown', 'utf8');
    writeFileSync(join(dir, 'blank.md'), '   \n', 'utf8');

    expect(await readKnowledgeBase(dir)).toBe('');
  });
});

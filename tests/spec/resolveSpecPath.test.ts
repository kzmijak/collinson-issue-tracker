import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { resolveSpecPath, SpecNotFoundError } from '../../src/spec/resolveSpecPath.js';

let specs: string;

beforeAll(() => {
  specs = mkdtempSync(join(tmpdir(), 'specs-'));
  for (const slug of ['001-prototype-issues-reader', '002-container-image', '0021-decoy']) {
    mkdirSync(join(specs, slug));
    writeFileSync(join(specs, slug, 'spec.md'), '# spec');
  }
});

describe('resolveSpecPath', () => {
  it('resolves a bare number to that spec', () => {
    expect(resolveSpecPath('001', specs)).toBe(join(specs, '001-prototype-issues-reader/spec.md'));
  });

  it('resolves a full slug', () => {
    expect(resolveSpecPath('002-container-image', specs)).toBe(
      join(specs, '002-container-image/spec.md'),
    );
  });

  it('returns an explicit path untouched', () => {
    const path = join(specs, '002-container-image/spec.md');
    expect(resolveSpecPath(path, specs)).toBe(path);
  });

  it('refuses a prefix that matches more than one spec', () => {
    expect(() => resolveSpecPath('002', specs)).toThrow(/more than one/);
  });

  it('refuses a prefix that matches nothing', () => {
    expect(() => resolveSpecPath('999', specs)).toThrow(SpecNotFoundError);
  });
});

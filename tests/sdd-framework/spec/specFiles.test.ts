import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  assertBlackBox,
  normaliseGeneratedPath,
  pruneOrphans,
  readPreviousFiles,
  resolveGeneratedPath,
  SpecFileEscapeError,
  writeGeneratedFiles,
} from '../../../src/sdd-framework/spec/specFiles.js';

const script = { path: 'accs.bash', content: '#!/usr/bin/env bash\nexit 0', executable: true };

describe('resolveGeneratedPath', () => {
  it('accepts a path inside the spec directory', () => {
    expect(resolveGeneratedPath('/specs/001-x', 'accs.bash')).toBe('/specs/001-x/accs.bash');
  });

  it('accepts a nested path', () => {
    expect(resolveGeneratedPath('/specs/001-x', 'tests/mock.js')).toBe(
      '/specs/001-x/tests/mock.js',
    );
  });

  it('refuses an absolute path', () => {
    expect(() => resolveGeneratedPath('/specs/001-x', '/etc/passwd')).toThrow(SpecFileEscapeError);
  });

  it('refuses a path that climbs out with ..', () => {
    expect(() => resolveGeneratedPath('/specs/001-x', '../002-y/accs.bash')).toThrow(
      /outside the spec's own directory/,
    );
  });

  it('refuses a path that climbs out and back in', () => {
    expect(() => resolveGeneratedPath('/specs/001-x', 'a/../../../src/index.ts')).toThrow(
      SpecFileEscapeError,
    );
  });
});

describe('writeGeneratedFiles', () => {
  it('writes every file and makes the test script executable', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    const written = await writeGeneratedFiles(dir, [
      script,
      { path: 'tests/mock.js', content: 'const x = 1;' },
    ]);

    expect(written).toHaveLength(2);
    expect(readFileSync(join(dir, 'tests/mock.js'), 'utf8')).toBe('const x = 1;\n');
    expect(statSync(join(dir, 'accs.bash')).mode & 0o111).toBeTruthy();
    expect(statSync(join(dir, 'tests/mock.js')).mode & 0o111).toBeFalsy();
  });

  it('refuses a file set with no test script, writing nothing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await expect(writeGeneratedFiles(dir, [{ path: 'notes.md', content: 'x' }])).rejects.toThrow(
      /do not include accs.bash/,
    );
  });

  it('refuses the whole set when one path escapes, before writing any of it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await expect(
      writeGeneratedFiles(dir, [script, { path: '../escaped.ts', content: 'x' }]),
    ).rejects.toThrow(SpecFileEscapeError);
    expect(() => statSync(join(dir, 'accs.bash'))).toThrow();
  });
});

describe('normaliseGeneratedPath', () => {
  it('strips a repo-root prefix the prompt itself encourages', () => {
    expect(normaliseGeneratedPath('specs/001-x', 'specs/001-x/accs.bash')).toBe('accs.bash');
  });

  it('leaves an already spec-relative path alone', () => {
    expect(normaliseGeneratedPath('specs/001-x', 'accs.bash')).toBe('accs.bash');
  });

  it('does not strip a lookalike prefix belonging to another spec', () => {
    expect(normaliseGeneratedPath('specs/001-x', 'specs/001-xy/accs.bash')).toBe(
      'specs/001-xy/accs.bash',
    );
  });
});

describe('writeGeneratedFiles with repo-root paths', () => {
  it('writes them into the spec directory, not a nested copy of it', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    const written = await writeGeneratedFiles(dir, [
      { path: `${dir}/accs.bash`, content: 'exit 0', executable: true },
      { path: `${dir}/harness.mjs`, content: 'export {};' },
    ]);

    expect(written).toEqual([join(dir, 'accs.bash'), join(dir, 'harness.mjs')]);
    expect(readFileSync(join(dir, 'harness.mjs'), 'utf8')).toBe('export {};\n');
  });
});

describe('assertBlackBox', () => {
  it('refuses a check that imports from src', () => {
    expect(() =>
      assertBlackBox([
        { path: 'harness.mjs', content: "import { run } from '../../src/thing.ts';" },
      ]),
    ).toThrow(/reference `src\//);
  });

  it('refuses a shell script that runs a file under src', () => {
    expect(() =>
      assertBlackBox([{ path: 'accs.bash', content: 'node src/worker/main.ts' }]),
    ).toThrow(SpecFileEscapeError);
  });

  it('accepts a check that drives the command from outside', () => {
    expect(() =>
      assertBlackBox([
        {
          path: 'accs.bash',
          content: 'GITHUB_REPO=a/b pnpm worker > out.log\ngrep -q "#1" out.log',
        },
      ]),
    ).not.toThrow();
  });

  it('does not trip on words merely ending in src', () => {
    expect(() => assertBlackBox([{ path: 'accs.bash', content: 'echo websrc/foo' }])).not.toThrow();
  });
});

describe('readPreviousFiles', () => {
  it('reads the file list a previous run recorded', () => {
    const generated = '<!-- enrich:meta\nsource-sha: abc\nfile: accs.bash\nfile: harness.mjs\n-->';
    expect(readPreviousFiles(generated)).toEqual(['accs.bash', 'harness.mjs']);
  });

  it('returns nothing when a previous run recorded nothing', () => {
    expect(readPreviousFiles('<!-- enrich:meta\nsource-sha: abc\n-->')).toEqual([]);
  });
});

describe('pruneOrphans', () => {
  it('removes what the previous run generated and this one did not', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await writeGeneratedFiles(dir, [script, { path: 'stale.mjs', content: 'old' }]);

    const pruned = await pruneOrphans(dir, ['accs.bash', 'stale.mjs'], ['accs.bash']);

    expect(pruned).toEqual(['stale.mjs']);
    expect(() => statSync(join(dir, 'stale.mjs'))).toThrow();
    expect(statSync(join(dir, 'accs.bash')).isFile()).toBe(true);
  });

  it('leaves files the tool never generated alone', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await writeGeneratedFiles(dir, [script]);
    writeFileSync(join(dir, 'notes-by-hand.md'), 'mine');

    await pruneOrphans(dir, ['accs.bash'], ['accs.bash']);

    expect(statSync(join(dir, 'notes-by-hand.md')).isFile()).toBe(true);
  });
});

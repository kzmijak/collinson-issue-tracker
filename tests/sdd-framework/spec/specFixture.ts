import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readOperatorSection, sourceSha } from '../../../src/sdd-framework/spec/SpecFile.js';

export const OPERATOR = [
  '# 001 — Thing',
  '',
  '## What I want',
  '',
  '### 2026-09-09 — x',
  '',
  'prose',
].join('\n');

export const ACCS = 'Start it and check that it prints the issues.';

export interface FixtureOptions {
  operator?: string;
  /** null leaves accs.md out. */
  accs?: string | null;
  /** Omitted or null: never enriched. `sourceSha` defaults to the one matching spec.md and accs.md. */
  enriched?: { status: string; sourceSha?: string; body?: string } | null;
  accsScript?: string;
}

export interface Fixture {
  path: string;
  dir: string;
  output: string;
}

/** A spec directory in the current layout: spec.md, accs.md, and whatever output/ holds. */
export function specFixture(options: FixtureOptions = {}): Fixture {
  const dir = mkdtempSync(join(tmpdir(), 'spec-'));
  const output = join(dir, 'output');
  const path = join(dir, 'spec.md');
  const operator = options.operator ?? OPERATOR;
  const accs = options.accs === undefined ? ACCS : options.accs;

  writeFileSync(path, `${operator}\n`, 'utf8');
  if (accs !== null) writeFileSync(join(dir, 'accs.md'), `${accs}\n`, 'utf8');

  if (options.enriched) {
    mkdirSync(output, { recursive: true });
    const sha =
      options.enriched.sourceSha ?? sourceSha(readOperatorSection(operator), (accs ?? '').trim());
    writeFileSync(
      join(output, 'enriched-spec.md'),
      [
        '<!-- enrich:meta',
        `source-sha: ${sha}`,
        `status: ${options.enriched.status}`,
        '-->',
        '',
        options.enriched.body ?? '## Read this first\n\nbody',
      ].join('\n'),
      'utf8',
    );
  }
  if (options.accsScript !== undefined) {
    mkdirSync(output, { recursive: true });
    writeFileSync(join(output, 'accs.bash'), options.accsScript, 'utf8');
  }
  return { path, dir, output };
}

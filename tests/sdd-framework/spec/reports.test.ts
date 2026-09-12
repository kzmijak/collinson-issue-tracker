import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  applyReport,
  enrichReport,
  latestReport,
  verifyReport,
  writeReport,
} from '../../../src/sdd-framework/spec/reports.js';
import type { EnrichedBody } from '../../../src/sdd-framework/spec/schemas/Enrichment.js';

const run = {
  spec: '001-thing',
  at: '2026-09-11T12:00:00.000Z',
  durationMs: 92_000,
  effectiveTokens: 118_204.5,
};

const spec: EnrichedBody = {
  summary: 'Polls a repository.',
  exports: [{ name: 'mock port', value: 'MOCK_GITHUB_PORT=4000', why: 'the check needs it' }],
  contract: [{ facade: '`pnpm start` prints `#<n> <title>`', promise: 'one line per issue' }],
  numbers: 'interval - 1000 ms',
  notThis: 'webhooks',
  doneWhen: ['x'],
  behaviours: [{ name: 'x', cases: [{ input: 'a', expected: 'b' }] }],
  decisions: [],
  outOfScope: [],
  openQuestions: [],
  drawbacks: ['reprints nothing on a restart'],
  assumptions: [{ question: 'Port?', choice: '4100, nothing said otherwise.' }],
};

describe('reports', () => {
  it('opens every report with what it cost and how long it took', () => {
    const text = enrichReport(run, { status: 'written', spec, accsFlow: ['start it'] });

    expect(text).toContain('# Enrichment report — 001-thing');
    expect(text).toContain('1m 32s');
    expect(text).toContain('118,205 ET');
  });

  it('gives an enrichment the operator’s four sections, the contract among them', () => {
    const text = enrichReport(run, { status: 'written', spec, accsFlow: ['start it', 'curl it'] });

    expect(text).toContain('## Assumptions made');
    expect(text).toContain('**Port?** 4100');
    expect(text).toContain('## Expected drawbacks');
    expect(text).toContain('| `pnpm start` prints `#<n> <title>` | one line per issue |');
    expect(text).toContain('1. start it\n2. curl it');
  });

  it('names design flaws when the enrichment was blocked', () => {
    const text = enrichReport(run, { status: 'blocked', designFlaws: ['two entries contradict'] });

    expect(text).toContain('## Design flaws');
    expect(text).toContain('- two entries contradict');
  });

  it('says why a spec was rejected and what has to be redone', () => {
    const text = verifyReport(run, {
      verdict: 'rejected',
      summary: 'the ACCS passes on noise',
      mustFix: [{ area: 'Falsifiability', quote: null, problem: 'matches any digit' }],
      shouldFix: [],
      shouldKnow: [{ area: 'Note', quote: null, problem: 'closed issues are never checked' }],
      fix: 'accs',
    });

    expect(text).toContain('Redo the ACCS only.');
    expect(text).toContain('## Why rejected');
    expect(text).toContain('matches any digit');
    expect(text).toContain('## Worth to consider');
  });

  it('lists what the implementer found wrong in the spec, for the operator to decide', () => {
    const text = applyReport(run, {
      status: 'converged',
      rounds: 1,
      implementation: {
        summary: 'Built the tracker.',
        files: ['src/issue-tracker/main.ts'],
        picks: [],
        findings: [
          { area: 'Coverage', quote: null, problem: 'accs.md never checks closed issues' },
        ],
        fix: 'accs',
        blocked: null,
        remedy: null,
      },
    });

    expect(text).toContain('converged after 1 round');
    expect(text).toContain('- **Coverage** accs.md never checks closed issues');
    expect(text).toContain('Redo the ACCS only.');
  });

  it('writes a report next to the metrics and hands back the latest of a kind', async () => {
    const output = mkdtempSync(join(tmpdir(), 'output-'));
    const path = await writeReport(output, 'verify', run.at, 'first');
    await writeReport(output, 'verify', '2026-09-11T12:05:00.000Z', 'second');

    expect(path).toContain(join('metrics', '2026-09-11T12-00-00Z--verify.md'));
    expect(readFileSync(path, 'utf8')).toBe('first');
    expect(await latestReport(output, 'verify')).toBe('second');
    expect(await latestReport(output, 'apply')).toBeNull();
  });
});

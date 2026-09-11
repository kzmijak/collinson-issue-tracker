import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  amendMetrics,
  latestMetricsPath,
  writeMetrics,
  type EnrichMetrics,
} from '../../../src/sdd-framework/spec/metrics.js';

const base: EnrichMetrics = {
  at: '2026-09-09T10:15:32.481Z',
  durationMs: 41200,
  entry: '2026-09-08 — Specify the requirements 2.0',
  sourceSha: '5bc4f57255ce',
  model: 'claude-sonnet-5',
  taskBudgetTokens: 45000,
  usage: { inputTokens: 25, outputTokens: 5718, cacheReadTokens: 0, cacheCreationTokens: 6260 },
  effectiveTokens: 72880,
  outcome: 'written',
};

describe('writeMetrics', () => {
  it('names the file by timestamp and the entry that prompted the run', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    const path = await writeMetrics(dir, base);

    expect(path).toContain('metrics/2026-09-09T10-15-32Z--specify-the-requirements-2-0.json');
    expect(JSON.parse(readFileSync(path, 'utf8')).effectiveTokens).toBe(72880);
  });

  it('drops the entry date from the name, since the timestamp is finer', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    const path = await writeMetrics(dir, base);
    expect(path).not.toContain('--2026-09-08');
  });

  it('keeps every run of the same entry side by side', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await writeMetrics(dir, base);
    await writeMetrics(dir, { ...base, at: '2026-09-09T10:19:04.000Z', outcome: 'blocked' });

    expect(readdirSync(join(dir, 'metrics'))).toHaveLength(2);
  });

  it('records a failed run, because it still cost tokens', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    const path = await writeMetrics(dir, {
      ...base,
      outcome: 'contract-error',
      detail: 'the model returned no JSON at all',
    });

    const written = JSON.parse(readFileSync(path, 'utf8'));
    expect(written.outcome).toBe('contract-error');
    expect(written.usage.outputTokens).toBe(5718);
  });
});

describe('amendMetrics', () => {
  it('adds a verdict to the latest run rather than starting a new file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await writeMetrics(dir, base);
    await writeMetrics(dir, { ...base, at: '2026-09-09T11:00:00.000Z' });

    const path = await amendMetrics(dir, {
      verification: {
        at: '2026-09-09T11:30:00.000Z',
        verdict: 'rejected',
        summary: 'the check cannot fail',
        mustFix: [
          { area: 'Falsifiability', quote: 'accs.bash exits 0', problem: 'nothing asserts.' },
        ],
        shouldFix: [],
        shouldKnow: [],
        effectiveTokens: 9000,
        specSha: 'deadbeef0000',
      },
    });

    expect(readdirSync(join(dir, 'metrics'))).toHaveLength(2);
    expect(path).toContain('11-00-00Z');

    const amended = JSON.parse(readFileSync(path!, 'utf8'));
    expect(amended.verification.verdict).toBe('rejected');
    expect(amended.effectiveTokens).toBe(72880);
  });

  it('refuses to invent a record for an enrichment that was never measured', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    expect(await amendMetrics(dir, { commits: [] })).toBeNull();
    expect(await latestMetricsPath(dir)).toBeNull();
  });

  it('accumulates commit notes across calls', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'spec-'));
    await writeMetrics(dir, base);

    await amendMetrics(dir, {
      commits: [{ at: 'x', sha: 'aaa1111', subject: 'spec(worker): 001' }],
    });
    const path = await amendMetrics(dir, {
      commits: [
        { at: 'x', sha: 'aaa1111', subject: 'spec(worker): 001' },
        { at: 'y', sha: 'bbb2222', subject: 'feat(worker): implement 001' },
      ],
    });

    expect(JSON.parse(readFileSync(path!, 'utf8')).commits).toHaveLength(2);
  });
});

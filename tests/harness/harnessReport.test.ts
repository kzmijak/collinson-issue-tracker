import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  renderHarnessTable,
  summarizeByConfig,
  writeHarnessOutputs,
} from '../../src/harness/harnessReport.js';
import type { HarnessEntry } from '../../src/harness/harnessTypes.js';

function entry(overrides: Partial<HarnessEntry> = {}): HarnessEntry {
  return {
    config: 'claude-haiku-4-5-medium-off',
    issueId: 1,
    expectedPriority: 3,
    expectedEffort: 2,
    actualPriority: 3,
    actualEffort: 2,
    penalty: 0,
    arrived: true,
    et: 10,
    timeMs: 5,
    disqualified: false,
    ...overrides,
  };
}

describe('summarizeByConfig', () => {
  it('averages accuracy, sums et and time, and counts failures per config', () => {
    const entries = [
      entry({ issueId: 1, penalty: 0, et: 10, timeMs: 5 }),
      entry({ issueId: 2, arrived: false, penalty: 38, et: 0, timeMs: 0 }),
    ];

    const [summary] = summarizeByConfig(entries);

    expect(summary.config).toBe('claude-haiku-4-5-medium-off');
    expect(summary.combinedAccuracy).toBeCloseTo(0.5, 5);
    expect(summary.failures).toBe(1);
    expect(summary.totalEt).toBe(10);
    expect(summary.totalTimeMs).toBe(5);
  });

  it('marks a config disqualified once any of its entries is', () => {
    const entries = [entry({ issueId: 1 }), entry({ issueId: 2, disqualified: true })];
    const [summary] = summarizeByConfig(entries);
    expect(summary.disqualified).toBe(true);
  });

  it('keeps configs separate, one summary row per config', () => {
    const entries = [entry({ config: 'a' }), entry({ config: 'b' })];
    expect(summarizeByConfig(entries).map((s) => s.config)).toEqual(['a', 'b']);
  });
});

describe('renderHarnessTable', () => {
  it('renders exactly one non-blank row per config, in the combined/priority/effort/failures/disqualified/et/time column order', () => {
    const [summary] = summarizeByConfig([entry()]);
    const table = renderHarnessTable([summary]);
    const row = table.split('\n').find((line) => line.startsWith(`| ${summary.config} `));

    expect(row).toBeDefined();
    expect(row).not.toMatch(/\|\s*\|/);
    const cells = row!.split('|').map((cell) => cell.trim());
    expect(cells).toEqual([
      '',
      summary.config,
      summary.combinedAccuracy.toFixed(4),
      summary.priorityAccuracy.toFixed(4),
      summary.effortAccuracy.toFixed(4),
      String(summary.failures),
      String(summary.disqualified),
      String(summary.totalEt),
      String(summary.totalTimeMs),
      '',
    ]);
  });
});

describe('writeHarnessOutputs', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'harness-report-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('writes the machine-readable json and the readable md under <generatedDir>/<specId>/', async () => {
    const entries = [entry()];
    const { jsonPath, mdPath } = await writeHarnessOutputs(
      dir,
      '004-classifier-harness',
      'run-1',
      entries,
    );

    expect(jsonPath).toBe(join(dir, '004-classifier-harness', 'harness-run-1.json'));
    expect(mdPath).toBe(join(dir, '004-classifier-harness', 'harness-run-1.md'));
    expect(JSON.parse(readFileSync(jsonPath, 'utf8'))).toEqual(entries);
    expect(readFileSync(mdPath, 'utf8')).toContain(entry().config);
  });
});

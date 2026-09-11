import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { enrichAccs } from '../../../src/sdd-framework/spec/enrichAccs.js';
import { readStatus } from '../../../src/sdd-framework/spec/SpecFile.js';
import { specFixture } from './specFixture.js';
import type { Llm, SystemPromptData, TokenUsage } from '../../../src/sdd-framework/llm/Llm.js';
import type { AccsFiles } from '../../../src/sdd-framework/spec/schemas/Accs.js';

class FakeLlm implements Llm {
  calls = 0;
  lastUsage: Record<string, unknown> | null = null;

  constructor(private readonly answer: AccsFiles) {}

  async prompt<TOutput>(): Promise<TOutput> {
    this.calls += 1;
    return this.answer as unknown as TOutput;
  }
  updateSystemPrompt(_data: SystemPromptData): void {}
  get lastEffectiveTokens(): number {
    return 500;
  }
  get totalUsage(): TokenUsage {
    return { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
  get lastCallUsage(): TokenUsage {
    return this.totalUsage;
  }
}

function spec(
  mustFix: unknown[],
  shouldFix: unknown[] = [],
): {
  path: string;
  output: string;
} {
  const { path, output } = specFixture({
    enriched: { status: 'rejected', body: '## Read this first\n\nsome prose for reference' },
    accsScript: '#!/usr/bin/env bash\nexit 1\n',
  });

  const metricsDir = join(output, 'metrics');
  mkdirSync(metricsDir, { recursive: true });
  writeFileSync(
    join(metricsDir, '2026-09-09T00-00-00Z--x.json'),
    JSON.stringify({
      at: '2026-09-09T00:00:00Z',
      durationMs: 1,
      entry: '2026-09-09 — x',
      sourceSha: 'aaaaaaaaaaaa',
      model: 'claude-sonnet-5',
      usage: { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 },
      effectiveTokens: 1000,
      outcome: 'written',
      verification: {
        at: '2026-09-09T00:01:00Z',
        verdict: 'rejected',
        summary: 'backoff untested',
        mustFix,
        shouldFix,
        shouldKnow: [],
        effectiveTokens: 2000,
        specSha: 'bbbbbbbbbbbb',
      },
    }),
    'utf8',
  );

  return { path, output };
}

describe('enrichAccs', () => {
  it('refuses cheaply, without calling the model, when the last verdict named no gaps', async () => {
    const { path } = spec([], []);
    const llm = new FakeLlm({ files: [{ path: 'accs.bash', content: 'echo PASS\n' }] });

    const result = await enrichAccs(path, llm, { model: 'claude-sonnet-5' });

    expect(result.status).toBe('nothing-to-fix');
    expect(llm.calls).toBe(0);
  });

  it('rewrites only accs.bash and resets status, leaving the rest of the spec untouched', async () => {
    const { path, output } = spec([
      { area: 'Falsifiability', quote: 'doubles', problem: 'untested' },
    ]);
    const llm = new FakeLlm({
      files: [{ path: 'accs.bash', content: '#!/usr/bin/env bash\necho PASS\n' }],
    });

    const result = await enrichAccs(path, llm, { model: 'claude-sonnet-5' });

    expect(result.status).toBe('written');
    expect(llm.calls).toBe(1);

    const enriched = readFileSync(join(output, 'enriched-spec.md'), 'utf8');

    expect(readFileSync(path, 'utf8')).toContain('### 2026-09-09 — x');
    expect(enriched).toContain('some prose for reference');
    expect(readStatus(enriched)).toBe('draft');
    expect(readFileSync(join(output, 'accs.bash'), 'utf8')).toContain('echo PASS');
  });
});

import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';
import { StaleEnrichmentError, verify } from '../../../src/sdd-framework/spec/verify.js';
import { specFixture } from './specFixture.js';
import type { Llm, SystemPromptData, TokenUsage } from '../../../src/sdd-framework/llm/Llm.js';

/** Mirrors ClaudeCodeLlm: usage lands before the call can throw, since the SDK already returned. */
class ThrowsAfterSpending implements Llm {
  lastUsage: Record<string, unknown> | null = null;

  async prompt<TOutput>(): Promise<TOutput> {
    this.lastUsage = {
      input_tokens: 10,
      output_tokens: 20,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    };
    throw new ModelContractError('the verifier did not return the agreed JSON shape: shouldKnow.0');
  }
  updateSystemPrompt(_data: SystemPromptData): void {}
  get lastEffectiveTokens(): number {
    return this.lastUsage ? 10 + 20 * 5 : 0;
  }
  get totalUsage(): TokenUsage {
    return { inputTokens: 10, outputTokens: 20, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
  get lastCallUsage(): TokenUsage {
    return this.totalUsage;
  }
}

/** A spec with an existing enrichment record, since `amendMetrics` has nothing to add to otherwise. */
function specWithEnrichment(sourceSha?: string): string {
  const { path, output } = specFixture({ enriched: { status: 'draft', sourceSha } });

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
    }),
    'utf8',
  );

  return path;
}

describe('verify', () => {
  it('records what was spent even when the call throws, instead of losing it', async () => {
    const path = specWithEnrichment();
    const llm = new ThrowsAfterSpending();

    await expect(verify(path, llm)).rejects.toThrow(ModelContractError);

    const metricsDir = join(path, '..', 'output', 'metrics');
    const files = readdirSync(metricsDir).sort();
    const record = JSON.parse(readFileSync(join(metricsDir, files.at(-1)!), 'utf8'));

    expect(record.verificationFailure.effectiveTokens).toBe(110);
    expect(record.verificationFailure.detail).toContain('shouldKnow.0');
    expect(record.verification).toBeUndefined();
  });

  it('refuses a spec whose spec.md or accs.md changed since it was enriched, before spending anything', async () => {
    const llm = new ThrowsAfterSpending();

    await expect(verify(specWithEnrichment('aaaaaaaaaaaa'), llm)).rejects.toThrow(
      StaleEnrichmentError,
    );
    expect(llm.lastUsage).toBeNull();
  });

  it('refuses a spec that has never been enriched', async () => {
    const llm = new ThrowsAfterSpending();

    await expect(verify(specFixture().path, llm)).rejects.toThrow(/never been enriched/);
  });

  it('refuses a spec with no accs.md, since there is nothing to check the ACCS against', async () => {
    const llm = new ThrowsAfterSpending();
    const { path } = specFixture({ accs: null, enriched: { status: 'draft' } });

    await expect(verify(path, llm)).rejects.toThrow(/accs\.md does not exist/);
  });
});

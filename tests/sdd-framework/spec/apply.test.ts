import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply, type ApplyProps } from '../../../src/sdd-framework/spec/apply.js';
import type { Llm, SystemPromptData, TokenUsage } from '../../../src/sdd-framework/llm/Llm.js';
import { headSha, splitSpec } from '../../../src/sdd-framework/spec/SpecFile.js';

const props: ApplyProps = {
  model: 'claude-sonnet-5',
  effectiveTokenBudget: 800_000,
  rounds: 2,
  checkTimeoutMs: 5_000,
  timeLimitMs: 60_000,
  force: false,
};

/** Any call is a failure here: every case below must settle before a token is spent. */
class NeverCalled implements Llm {
  calls = 0;
  lastUsage: Record<string, unknown> | null = null;

  prompt<TOutput>(): Promise<TOutput> {
    this.calls += 1;
    throw new Error('the implementer must not be called');
  }
  updateSystemPrompt(_data: SystemPromptData): void {}
  get lastEffectiveTokens(): number {
    return 0;
  }
  get totalUsage(): TokenUsage {
    return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
  get lastCallUsage(): TokenUsage {
    return this.totalUsage;
  }
}

/** Answers every round as done; the check decides whether it was. */
class AlwaysAnswers extends NeverCalled {
  prompt<TOutput>(): Promise<TOutput> {
    this.calls += 1;
    return Promise.resolve({
      summary: 'done',
      files: [],
      picks: [],
      blocked: null,
      remedy: null,
    } as TOutput);
  }
}

const HEAD = [
  '# 001 — Thing',
  '',
  '## What I want',
  '',
  '### 2026-09-09 — x',
  '',
  'prose',
  '',
  '<!-- enrich:generated -->',
].join('\n');

function spec(status: string, check = 'exit 1', sourceSha = headSha(splitSpec(HEAD).head)): string {
  const dir = mkdtempSync(join(tmpdir(), 'apply-'));
  const path = join(dir, 'spec.md');

  writeFileSync(
    path,
    [HEAD, '', '<!-- enrich:meta', `source-sha: ${sourceSha}`, `status: ${status}`, '-->'].join(
      '\n',
    ),
    'utf8',
  );
  writeFileSync(join(dir, 'accs.bash'), check, 'utf8');

  return path;
}

describe('apply', () => {
  it('refuses a spec the verifier has not approved, before spending anything', async () => {
    const llm = new NeverCalled();
    const result = await apply(spec('draft'), llm, props);

    expect(result.status).toBe('refused');
    expect(result.detail).toContain('not "approved"');
    expect(llm.calls).toBe(0);
  });

  it('does nothing when the check already passes, because the check is the plan step', async () => {
    const llm = new NeverCalled();
    const result = await apply(spec('approved', 'echo PASS'), llm, props);

    expect(result.status).toBe('nothing-to-do');
    expect(result.check?.exitCode).toBe(0);
    expect(llm.calls).toBe(0);
  });

  it('reports a check it cannot run rather than asking an implementer to fix it', async () => {
    const llm = new NeverCalled();
    const result = await apply(spec('approved', 'sleep 30'), llm, {
      ...props,
      checkTimeoutMs: 300,
    });

    expect(result.status).toBe('check-unrunnable');
    expect(result.detail).toContain('has not judged anything');
    expect(llm.calls).toBe(0);
  });

  it('starts no new round once the time limit has passed', async () => {
    const llm = new AlwaysAnswers();
    const result = await apply(spec('approved'), llm, { ...props, rounds: 3, timeLimitMs: 0 });

    expect(result.status).toBe('time-exhausted');
    expect(llm.calls).toBe(1);
  });

  it('refuses an approved spec whose operator section changed after approval', async () => {
    const llm = new NeverCalled();
    const result = await apply(spec('approved', 'exit 1', 'aaaaaaaaaaaa'), llm, props);

    expect(result.status).toBe('refused');
    expect(result.detail).toContain('run `pnpm enrich`');
    expect(llm.calls).toBe(0);
  });
});

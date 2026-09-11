import { describe, expect, it } from 'vitest';
import { apply, type ApplyProps } from '../../../src/sdd-framework/spec/apply.js';
import type { Llm, SystemPromptData, TokenUsage } from '../../../src/sdd-framework/llm/Llm.js';
import { specFixture } from './specFixture.js';

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

/** An enriched spec with the given status, whose ACCS is the given shell snippet. */
function spec(status: string, check = 'exit 1', sourceSha?: string): string {
  return specFixture({ enriched: { status, sourceSha }, accsScript: check }).path;
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

  it('starts no new round once the time limit has passed', async () => {
    const llm = new AlwaysAnswers();
    const result = await apply(spec('approved'), llm, { ...props, rounds: 3, timeLimitMs: 0 });

    expect(result.status).toBe('time-exhausted');
    expect(llm.calls).toBe(1);
  });

  it('refuses an approved spec whose spec.md or accs.md changed after approval', async () => {
    const llm = new NeverCalled();
    const result = await apply(spec('approved', 'exit 1', 'aaaaaaaaaaaa'), llm, props);

    expect(result.status).toBe('refused');
    expect(result.detail).toContain('run `pnpm enrich`');
    expect(llm.calls).toBe(0);
  });

  it('treats any non-zero check as work to do, exit 2 included — the thing it checks may not exist yet', async () => {
    const llm = new AlwaysAnswers();
    const result = await apply(spec('approved', 'exit 2'), llm, props);

    expect(llm.calls).toBe(2);
    expect(result.status).toBe('not-converged');
  });

  it('treats a check that times out before implementation as work to do', async () => {
    const llm = new AlwaysAnswers();
    const result = await apply(spec('approved', 'sleep 30'), llm, {
      ...props,
      rounds: 1,
      checkTimeoutMs: 300,
    });

    expect(llm.calls).toBe(1);
    expect(result.status).toBe('not-converged');
  });
});

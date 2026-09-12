import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { apply, type ApplyProps } from '../../../src/sdd-framework/spec/apply.js';
import {
  EffectiveTokenCeilingError,
  type Llm,
  type SystemPromptData,
  type TokenUsage,
} from '../../../src/sdd-framework/llm/Llm.js';
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

/** Runs past whatever hard limit it is given, as a runaway would. */
class RunsAway extends NeverCalled {
  limits: (number | undefined)[] = [];
  prompt<TOutput>(_prompt?: unknown, options?: { maxEffectiveTokens?: number }): Promise<TOutput> {
    this.calls += 1;
    this.limits.push(options?.maxEffectiveTokens);
    return Promise.reject(new EffectiveTokenCeilingError(options?.maxEffectiveTokens ?? 0, 1));
  }
}

/** Sends the ACCS back, the way a verifier would. */
class SendsBack extends NeverCalled {
  prompt<TOutput>(): Promise<TOutput> {
    this.calls += 1;
    return Promise.resolve({
      summary: 'the ACCS greps a log full of colour codes',
      files: [],
      picks: [],
      findings: [{ area: 'Method', quote: null, problem: 'grep sees a binary file' }],
      fix: 'accs',
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

  it('sends the spec back like a verifier when the implementer rejects it', async () => {
    const fixture = specFixture({ enriched: { status: 'approved' }, accsScript: 'exit 1' });
    mkdirSync(join(fixture.output, 'metrics'), { recursive: true });
    const record = join(fixture.output, 'metrics', '2026-09-11T00-00-00Z--x.json');
    writeFileSync(record, '{}');

    const result = await apply(fixture.path, new SendsBack(), { ...props, rounds: 1 });

    const verification = JSON.parse(readFileSync(record, 'utf8')).verification;
    expect(result.implementation?.fix).toBe('accs');
    expect(readFileSync(join(fixture.output, 'enriched-spec.md'), 'utf8')).toContain(
      'status: rejected',
    );
    expect(verification).toMatchObject({ verdict: 'rejected', fix: 'accs', by: 'implementer' });
    expect(verification.mustFix[0].problem).toBe('grep sees a binary file');
  });

  it('stops at the hard limit, still judging the tree with the check', async () => {
    const llm = new RunsAway();
    const result = await apply(spec('approved'), llm, {
      ...props,
      rounds: 3,
      hardEffectiveTokenLimit: 1_000_000,
    });

    expect(result.status).toBe('budget-exhausted');
    expect(llm.calls).toBe(1);
    expect(llm.limits).toEqual([1_000_000]);
    expect(result.check?.exitCode).toBe(1);
  });

  it('counts a run cut off at the hard limit as converged when the check passes anyway', async () => {
    // Fails the first time and passes the second, so there is work to do and it turns out done.
    const marker = join(mkdtempSync(join(tmpdir(), 'check-')), 'ran');
    const check = `[ -f ${marker} ] && exit 0; touch ${marker}; exit 1`;

    const result = await apply(spec('approved', check), new RunsAway(), {
      ...props,
      rounds: 1,
      hardEffectiveTokenLimit: 1_000_000,
    });

    expect(result.status).toBe('converged');
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { Llm, SystemPromptData, TokenUsage } from '../../../src/sdd-framework/llm/Llm.js';
import type { Prompt } from '../../../src/sdd-framework/llm/Prompt.js';
import { readStatus } from '../../../src/sdd-framework/spec/SpecFile.js';
import { specFixture } from './specFixture.js';
import { verifyLoop } from '../../../src/sdd-framework/spec/verifyLoop.js';

/** Answers from a script, repeating the last answer once it runs out. */
class ScriptedLlm implements Llm {
  calls = 0;
  lastUsage: Record<string, unknown> | null = null;

  constructor(private readonly answers: object[]) {}

  async prompt<TOutput>(prompt: Prompt<TOutput>): Promise<TOutput> {
    const answer = this.answers[Math.min(this.calls, this.answers.length - 1)];
    this.calls += 1;
    return prompt.parseOutput(JSON.stringify(answer));
  }
  updateSystemPrompt(_data: SystemPromptData): void {}
  get lastEffectiveTokens(): number {
    return 1000;
  }
  get totalUsage(): TokenUsage {
    return { inputTokens: 1, outputTokens: 1, cacheReadTokens: 0, cacheCreationTokens: 0 };
  }
  get lastCallUsage(): TokenUsage {
    return this.totalUsage;
  }
}

const enriched = {
  blocking: [],
  body: {
    summary: 'x',
    check: 'bash output/accs.bash',
    proves: 'x',
    numbers: 'x',
    notThis: 'x',
    doneWhen: ['x'],
    behaviours: [{ name: 'x', cases: [{ input: 'a', expected: 'b' }] }],
    acceptance: { command: 'bash output/accs.bash', expectation: 'exits 0' },
    decisions: [],
    outOfScope: [],
    openQuestions: [],
    assumptions: [],
  },
};

const accs = { files: [{ path: 'accs.bash', content: 'exit 0\n', executable: true }] };
const fixedAccs = { files: [{ path: 'accs.bash', content: 'echo fixed\n', executable: true }] };

function rejected(fix: 'spec' | 'accs') {
  return {
    verdict: 'rejected',
    summary: 'the ACCS passes on noise',
    mustFix: [{ area: 'Falsifiability', quote: null, problem: 'matches digits anywhere' }],
    shouldFix: [],
    shouldKnow: [],
    fix,
  };
}

const approved = {
  verdict: 'approved',
  summary: 'fine',
  mustFix: [],
  shouldFix: [],
  shouldKnow: [],
  fix: 'spec',
};

function output(path: string, name: string): string {
  return readFileSync(join(path, '..', 'output', name), 'utf8');
}

const context = { model: 'claude-sonnet-5' };

describe('verifyLoop', () => {
  it('enriches a spec that has never been enriched, then loops until the verifier approves', async () => {
    const { path } = specFixture();
    const agents = {
      enricher: new ScriptedLlm([enriched]),
      accsAuthor: new ScriptedLlm([accs]),
      verifier: new ScriptedLlm([rejected('spec'), approved]),
    };
    const steps: string[] = [];

    const result = await verifyLoop(path, agents, {
      maxTurns: 3,
      enrich: context,
      onStep: (step) => steps.push(`${step.turn}:${step.kind}`),
    });

    expect(result.status).toBe('approved');
    expect(steps).toEqual(['1:enrich', '1:verify', '2:enrich', '2:verify']);
    expect(agents.enricher.calls).toBe(2);
    expect(readStatus(output(path, 'enriched-spec.md'))).toBe('approved');
  });

  it('repairs only the ACCS when the verifier says the ACCS is what failed', async () => {
    const { path } = specFixture();
    const agents = {
      enricher: new ScriptedLlm([enriched]),
      accsAuthor: new ScriptedLlm([accs, fixedAccs]),
      verifier: new ScriptedLlm([rejected('accs'), approved]),
    };
    const steps: string[] = [];

    const result = await verifyLoop(path, agents, {
      maxTurns: 3,
      enrich: context,
      onStep: (step) => steps.push(`${step.turn}:${step.kind}`),
    });

    expect(result.status).toBe('approved');
    expect(steps).toEqual(['1:enrich', '1:verify', '2:fix-accs', '2:verify']);
    expect(agents.enricher.calls).toBe(1);
    expect(agents.accsAuthor.calls).toBe(2);
    expect(output(path, 'accs.bash')).toContain('echo fixed');
  });

  it('stops at the turn limit and leaves the spec rejected', async () => {
    const { path } = specFixture();
    const agents = {
      enricher: new ScriptedLlm([enriched]),
      accsAuthor: new ScriptedLlm([accs]),
      verifier: new ScriptedLlm([rejected('spec')]),
    };

    const result = await verifyLoop(path, agents, { maxTurns: 2, enrich: context });

    expect(result.status).toBe('exhausted');
    expect(agents.enricher.calls).toBe(2);
    expect(agents.verifier.calls).toBe(2);
    expect(result.effectiveTokens).toBe(6000);
    expect(readStatus(output(path, 'enriched-spec.md'))).toBe('rejected');
  });

  it('stops when the enricher blocks, without writing the ACCS or asking the verifier', async () => {
    const { path } = specFixture();
    const agents = {
      enricher: new ScriptedLlm([{ blocking: ['two entries contradict'], body: null }]),
      accsAuthor: new ScriptedLlm([accs]),
      verifier: new ScriptedLlm([approved]),
    };

    const result = await verifyLoop(path, agents, { maxTurns: 3, enrich: context });

    expect(result.status).toBe('blocked');
    expect(agents.accsAuthor.calls).toBe(0);
    expect(agents.verifier.calls).toBe(0);
  });
});

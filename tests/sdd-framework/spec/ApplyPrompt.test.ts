import { describe, expect, it } from 'vitest';
import { ApplyPrompt, ReapplyPrompt } from '../../../src/sdd-framework/spec/ApplyPrompt.js';
import { ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';

const answer = {
  summary: 'built it',
  files: ['src/thing.ts'],
  picks: [{ decision: 'name', chose: 'thing', why: 'shortest' }],
  blocked: null,
  remedy: null,
};

const prompt = new ApplyPrompt({
  spec: '# 001 — Thing\n\n## What I want\n\n### 2026-09-09 — x\n\nprose',
  artefacts: '### accs.bash\n\nexit 1',
  knowledge: '',
  instructions: 'You implement specifications.',
  script: 'specs/001-thing/accs.bash',
});

describe('ApplyPrompt', () => {
  it('accepts the agreed shape', () => {
    expect(prompt.parseOutput(JSON.stringify(answer))).toEqual(answer);
  });

  it('refuses an answer missing the record of what changed', () => {
    const { files: _files, ...withoutFiles } = answer;

    expect(() => prompt.parseOutput(JSON.stringify(withoutFiles))).toThrow(ModelContractError);
  });

  it('tells the implementer how short the answer has to be', () => {
    expect(ApplyPrompt.outputSpecification).toContain('at most three sentences');
    expect(ApplyPrompt.outputSpecification).toContain('"why": "<one sentence>"');
  });

  it('carries the spec, the generated files and the check command, and nothing else', () => {
    const message = prompt.createMessage();

    expect(message).toContain('### 2026-09-09 — x');
    expect(message).toContain('exit 1');
    expect(message).toContain('bash specs/001-thing/accs.bash');
    expect(message).toContain('(empty — nothing has been added to it yet)');
  });

  it('never restates a repo convention the identity is responsible for', () => {
    const message = prompt.createMessage().replace('You implement specifications.', '');

    for (const leak of ['src/sdd-framework/', 'TypeScript', 'Vitest', 'pnpm', 'git commit']) {
      expect(message).not.toContain(leak);
    }
  });
});

describe('ReapplyPrompt', () => {
  it('carries what the check said and how many rounds are left', () => {
    const message = new ReapplyPrompt(
      { exitCode: 1, output: 'FAIL: issue #1 missing', timedOut: false, durationMs: 10 },
      2,
      3,
    ).createMessage();

    expect(message).toContain('FAIL: issue #1 missing');
    expect(message).toContain('round 2 of 3');
    expect(message).toContain('exited 1');
  });
});

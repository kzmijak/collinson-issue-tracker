import { describe, expect, it } from 'vitest';
import { EnrichPrompt, ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';

const body = {
  summary: 'x',
  check: 'bash accs.bash',
  proves: 'x',
  numbers: 'x',
  notThis: 'x',
  doneWhen: ['x'],
  behaviours: [{ name: 'x', cases: [{ input: 'a', expected: 'b' }] }],
  acceptance: { command: 'bash accs.bash', expectation: 'exits 0' },
  decisions: [{ decision: 'x', why: 'y' }],
  outOfScope: ['x'],
  openQuestions: ['already here'],
  assumptions: [{ question: 'x', choice: 'y' }],
  files: [{ path: 'accs.bash', content: 'exit 0' }],
};

const prompt = new EnrichPrompt(
  '## What I want\n\n### 2026-09-09 — x\n\nprose',
  'Start it and curl it.',
);

describe('EnrichPrompt', () => {
  it('keeps a single genuine blocker as blocking', () => {
    const result = prompt.parseOutput(JSON.stringify({ blocking: ['entries contradict'], body }));

    expect(result.blocking).toEqual(['entries contradict']);
    expect(result.body?.openQuestions).toEqual(['already here']);
  });

  it('demotes surplus blockers so the spec still gets written', () => {
    const result = prompt.parseOutput(
      JSON.stringify({ blocking: ['naming?', 'format?', 'fixture?'], body }),
    );

    expect(result.blocking).toHaveLength(1);
    expect(result.body?.openQuestions).toEqual(['already here', 'format?', 'fixture?']);
  });

  it('leaves a blocked-with-no-body response alone', () => {
    const result = prompt.parseOutput(JSON.stringify({ blocking: ['a', 'b'], body: null }));

    expect(result.blocking).toHaveLength(2);
  });

  it('refuses output that does not match the contract', () => {
    expect(() => prompt.parseOutput('{"blocking":[]}')).toThrow(ModelContractError);
  });

  it("hands the enricher the operator's accs.md alongside spec.md", () => {
    const message = prompt.createMessage();

    expect(message).toContain('### 2026-09-09 — x');
    expect(message).toContain('## accs.md');
    expect(message).toContain('Start it and curl it.');
  });
});

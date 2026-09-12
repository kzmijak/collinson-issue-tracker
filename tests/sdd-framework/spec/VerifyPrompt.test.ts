import { describe, expect, it } from 'vitest';
import { ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';
import { VerifyPrompt } from '../../../src/sdd-framework/spec/VerifyPrompt.js';

const prompt = new VerifyPrompt('# 001 — Thing\n\nprose', '### output/accs.bash\n\nexit 1');

describe('VerifyPrompt', () => {
  it('accepts the fully-shaped answer', () => {
    const result = prompt.parseOutput(
      JSON.stringify({
        verdict: 'approved',
        summary: 'fine',
        mustFix: [],
        shouldFix: [{ area: 'Scope', quote: null, problem: 'x' }],
        shouldKnow: [{ area: 'Note', quote: null, problem: 'y' }],
      }),
    );

    expect(result.verdict).toBe('approved');
  });

  it('forces "rejected" when a mustFix is present, regardless of the stated verdict', () => {
    const result = prompt.parseOutput(
      JSON.stringify({
        verdict: 'approved',
        summary: 'fine',
        mustFix: [{ area: 'Falsifiability', quote: 'x', problem: 'y' }],
        shouldFix: [],
        shouldKnow: [],
      }),
    );

    expect(result.verdict).toBe('rejected');
  });

  it('accepts a bare string in shouldFix/shouldKnow, the exact shape one real run sent', () => {
    // The contract shows the object shape only once, for mustFix, and a model can send the other
    // two lists as plain strings instead — this run did, and the old schema threw away a correct
    // "rejected" verdict with two solid mustFix findings over it.
    const result = prompt.parseOutput(
      JSON.stringify({
        verdict: 'rejected',
        summary: 'two behaviours are never exercised',
        mustFix: [
          { area: 'Falsifiability', quote: 'shows an error indication', problem: 'never checked' },
        ],
        shouldFix: [],
        shouldKnow: [
          'Traceability not checked — I was not given the conversation this spec was agreed in.',
          'A carriage-return redraw could interleave with the issue-line count in ways the check does not anticipate.',
        ],
      }),
    );

    expect(result.verdict).toBe('rejected');
    expect(result.mustFix).toHaveLength(1);
    expect(result.shouldKnow).toEqual([
      {
        area: 'Note',
        quote: null,
        problem:
          'Traceability not checked — I was not given the conversation this spec was agreed in.',
      },
      {
        area: 'Note',
        quote: null,
        problem:
          'A carriage-return redraw could interleave with the issue-line count in ways the check does not anticipate.',
      },
    ]);
  });

  it('still refuses a genuinely wrong shape, such as a missing field', () => {
    expect(() =>
      prompt.parseOutput(
        JSON.stringify({ verdict: 'approved', mustFix: [], shouldFix: [], shouldKnow: [] }),
      ),
    ).toThrow(ModelContractError);
  });

  it('shows the object shape for all three lists, not only mustFix', () => {
    const shapes = VerifyPrompt.outputSpecification.match(/"area":/g) ?? [];

    expect(shapes).toHaveLength(3);
  });

  it('says what to do, since the identity carries the rules but not the task', () => {
    expect(prompt.createMessage()).toContain('## Your task');
  });

  it('shows the previous rejection and asks for it to be checked first', () => {
    const message = new VerifyPrompt('spec', 'files', {
      at: '2026-09-11T00:00:00Z',
      verdict: 'rejected',
      summary: 'the ACCS never reads the mock console',
      mustFix: [{ area: 'Coverage', quote: null, problem: 'no stdout check' }],
      shouldFix: [],
      shouldKnow: [],
      fix: 'accs',
      effectiveTokens: 0,
      specSha: 'x',
    }).createMessage();

    expect(message).toContain('## The previous verdict (verifier, rejected)');
    expect(message).toContain('- [Coverage] no stdout check');
    expect(message).toContain('each finding of the previous verdict was fixed');
  });

  it('asks nothing about a previous verdict when there is none', () => {
    expect(prompt.createMessage()).not.toContain('previous verdict');
  });

  it('takes an approved verdict that spells its range of fire as null', () => {
    const result = prompt.parseOutput(
      JSON.stringify({
        verdict: 'approved',
        summary: 'fine',
        mustFix: [],
        shouldFix: [],
        shouldKnow: [],
        fix: null,
      }),
    );

    expect(result.verdict).toBe('approved');
    expect(result.fix).toBe('full');
  });

  it('falls back to an earlier block when the model corrects itself into a broken one', () => {
    const good = JSON.stringify({
      verdict: 'approved',
      summary: 'fine',
      mustFix: [],
      shouldFix: [],
      shouldKnow: [],
      fix: 'accs',
    });

    const result = prompt.parseOutput(
      `Here it is:\n\n\`\`\`json\n${good}\n\`\`\`\n\nWait, correcting:\n\n\`\`\`json\n{ "verdict": "approved" }\n\`\`\``,
    );

    expect(result.summary).toBe('fine');
  });
});

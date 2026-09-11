import { describe, expect, it } from 'vitest';
import { JsonPrompt } from '../../../src/sdd-framework/llm/JsonPrompt.js';

class Probe extends JsonPrompt<{ verdict: string }> {
  protected outputParser(output: object): { verdict: string } {
    return output as { verdict: string };
  }
}

const probe = new Probe();

describe('JsonPrompt', () => {
  it('reads a bare JSON object', () => {
    expect(probe.parseOutput('{"verdict":"accepted"}').verdict).toBe('accepted');
  });

  it('prefers a fenced block over braces that appear earlier in prose', () => {
    const output = [
      '### Report',
      'The check {as written} cannot fail.',
      '',
      '```json',
      '{"verdict":"rejected"}',
      '```',
    ].join('\n');

    expect(probe.parseOutput(output).verdict).toBe('rejected');
  });

  it('takes the last fenced block, so an example does not win over the answer', () => {
    const output =
      '```json\n{"verdict":"example"}\n```\nand now really:\n```json\n{"verdict":"real"}\n```';
    expect(probe.parseOutput(output).verdict).toBe('real');
  });

  it('falls back to braces when there is no fence', () => {
    expect(probe.parseOutput('here you go: {"verdict":"accepted"} done').verdict).toBe('accepted');
  });
});

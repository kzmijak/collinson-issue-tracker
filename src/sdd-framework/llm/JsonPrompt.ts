import { jsonrepair } from 'jsonrepair';
import { Prompt } from './Prompt.js';

export abstract class JsonPrompt<TOutput> extends Prompt<TOutput> {
  parseOutput(output: string): TOutput {
    let failure: unknown = null;

    // Every candidate, newest first: one model answered, corrected itself, and answered again, and
    // taking only its last block threw a finished verdict away.
    for (const candidate of extractJson(output)) {
      try {
        return this.outputParser(JSON.parse(jsonrepair(candidate)));
      } catch (error) {
        failure = error;
      }
    }

    console.error('[parseOutput] raw output:', JSON.stringify(output));
    console.error('[parseOutput] no usable JSON:', (failure as Error | null)?.message);
    return this.outputParser(JSON.parse('{}'));
  }

  protected abstract outputParser(output: object): TOutput;
}

/**
 * A model asked for JSON often surrounds it with prose, and prose contains braces. Every fenced
 * block is a candidate, last first, since the last is usually the answer and an earlier one is the
 * answer when the last turns out to be a correction that lost a field. The outermost braces are the
 * last resort, for an answer that came with no fence at all.
 */
export function extractJson(output: string): string[] {
  const fenced = [...output.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)]
    .map((match) => match[1])
    .filter((block) => block.trim().startsWith('{'))
    .reverse();

  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');
  const bare = start >= 0 && end > start ? [output.slice(start, end + 1)] : [];

  return [...fenced, ...bare];
}

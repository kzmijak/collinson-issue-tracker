import { jsonrepair } from 'jsonrepair';
import { Prompt } from './Prompt.js';

export abstract class JsonPrompt<TOutput> extends Prompt<TOutput> {
  parseOutput(output: string): TOutput {
    const json = extractJson(output);
    try {
      return this.outputParser(JSON.parse(jsonrepair(json)));
    } catch (e) {
      console.error('[parseOutput] raw output:', JSON.stringify(output));
      console.error('[parseOutput] parse failed, falling back to empty:', (e as Error).message);
      return this.outputParser(JSON.parse('{}'));
    }
  }

  protected abstract outputParser(output: object): TOutput;
}

/**
 * A model asked for JSON often surrounds it with prose, and prose contains braces. Prefer the last
 * fenced block, which is the answer; fall back to the outermost braces only when there is no fence.
 */
function extractJson(output: string): string {
  const fenced = [...output.matchAll(/```(?:json)?\s*\n([\s\S]*?)```/g)].at(-1)?.[1];
  if (fenced?.trim().startsWith('{')) return fenced;

  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');

  return start >= 0 && end > start ? output.slice(start, end + 1) : '{}';
}

import { jsonrepair } from 'jsonrepair';
import { Prompt } from './Prompt.js';

export abstract class JsonPrompt<TOutput> extends Prompt<TOutput> {
  parseOutput(output: string): TOutput {
    const start = output.indexOf('{');
    const end = output.lastIndexOf('}');
    const json = start >= 0 && end > start ? output.slice(start, end + 1) : '{}';
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

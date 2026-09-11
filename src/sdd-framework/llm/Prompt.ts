export abstract class Prompt<TOutput = string> {
  createMessage(): string {
    return this.messageInstruction;
  }
  abstract parseOutput(output: string): TOutput;

  protected messageInstruction: string =
    'Now respond according to your task instructions in the system prompt.';
  static outputSpecification: string = '';
}

export type OutputTypeOf<TPrompt extends Prompt> =
  TPrompt extends Prompt<infer TOutput> ? TOutput : never;

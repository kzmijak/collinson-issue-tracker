import type { Llm, TokenUsage } from './Llm.js';

export abstract class Participant {
  constructor(
    readonly name: string,
    protected readonly llm: Llm,
  ) {}

  get tokenUsage(): TokenUsage {
    return this.llm.totalUsage;
  }

  get lastCallUsage(): TokenUsage {
    return this.llm.lastCallUsage;
  }
}

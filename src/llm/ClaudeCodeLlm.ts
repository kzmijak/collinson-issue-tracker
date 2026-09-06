import { Options, query, type ThinkingConfig } from '@anthropic-ai/claude-agent-sdk';
import { Prompt } from './Prompt.js';
import type { Llm, SystemPromptData, TokenUsage } from './Llm.js';

export class ClaudeCodeLlm implements Llm {
  private sessionId: string | null = null;
  private costMultiplier: number;
  private readonly model: string;
  private readonly tools: string[];
  private systemPrompt = new SystemPrompt();
  private _totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };
  private _lastCallUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheCreationTokens: 0,
  };

  constructor(model = 'claude-haiku-4-5', identity: string, tools: string[] = []) {
    this.model = model;
    this.costMultiplier = MODEL_COST[model] ?? 1;
    this.tools = tools;
    this.updateSystemPrompt({ identity });
  }

  lastUsage: Record<string, unknown> | null = null;

  get lastEffectiveTokens(): number {
    const u = this.lastUsage as Record<string, number> | null;
    if (!u) return 0;
    return (
      (u.cache_read_input_tokens * 0.1 +
        u.cache_creation_input_tokens * 1.25 +
        u.input_tokens * 1 +
        u.output_tokens * 5) *
      this.costMultiplier
    );
  }

  get totalUsage(): TokenUsage {
    return { ...this._totalUsage };
  }

  get lastCallUsage(): TokenUsage {
    return { ...this._lastCallUsage };
  }

  async prompt<TOutput>(
    prompt: Prompt<TOutput>,
    options: { fresh?: boolean; thinking?: ThinkingConfig } = {},
  ): Promise<TOutput> {
    this._lastCallUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    if (options.fresh) this.sessionId = null;
    const outputSpecification = (prompt.constructor as typeof Prompt).outputSpecification;
    this.updateSystemPrompt({ instructions: outputSpecification });
    const response = await this.query(prompt.createMessage(), options.thinking);

    return prompt.parseOutput(response);
  }

  updateSystemPrompt(systemPrompt: SystemPromptData) {
    this.systemPrompt.update(systemPrompt);
  }

  private async query(message: string, thinking?: ThinkingConfig): Promise<string> {
    const options: Options = {
      model: this.model,
      tools: this.tools,
      permissionMode: 'bypassPermissions',
      systemPrompt: this.systemPrompt?.toString(),
      ...(this.sessionId && { resume: this.sessionId }),
      ...(thinking && { thinking }),
    };

    const q = query({ prompt: message, options });

    for await (const event of q) {
      if (event.type !== 'result') continue;
      if (event.type === 'result' && event.subtype !== 'success') {
        throw new Error(event.errors?.[0] ?? 'Mind went blank');
      }

      this.lastUsage = event.usage;
      const u = event.usage as unknown as Record<string, number | undefined>;
      this._totalUsage.inputTokens += u.input_tokens ?? 0;
      this._totalUsage.outputTokens += u.output_tokens ?? 0;
      this._totalUsage.cacheReadTokens += u.cache_read_input_tokens ?? 0;
      this._totalUsage.cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
      this._lastCallUsage.inputTokens += u.input_tokens ?? 0;
      this._lastCallUsage.outputTokens += u.output_tokens ?? 0;
      this._lastCallUsage.cacheReadTokens += u.cache_read_input_tokens ?? 0;
      this._lastCallUsage.cacheCreationTokens += u.cache_creation_input_tokens ?? 0;
      if (event.session_id) this.sessionId = event.session_id;

      return event.result;
    }

    throw new Error('Stream ended without a result');
  }
}

const MODEL_COST: Record<string, number> = {
  'claude-haiku-4-5': 1,
  'claude-sonnet-4-6': 3,
  'claude-opus-4-6': 5,
};

class SystemPrompt {
  constructor(public data: SystemPromptData = {}) {}

  update(diff: SystemPromptData) {
    Object.assign(this.data, diff);
  }

  toString(): string {
    return [this.data.rules, this.data.identity, this.data.instructions]
      .filter(Boolean)
      .join('\n\n');
  }
}

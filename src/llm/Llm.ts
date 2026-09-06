import type { ThinkingConfig } from '@anthropic-ai/claude-agent-sdk';
import type { Prompt } from './Prompt.js';

export interface Llm {
  prompt<TOutput>(
    prompt: Prompt<TOutput>,
    options?: { fresh?: boolean; thinking?: ThinkingConfig },
  ): Promise<TOutput>;
  updateSystemPrompt(data: SystemPromptData): void;
  readonly lastEffectiveTokens: number;
  readonly totalUsage: TokenUsage;
  readonly lastCallUsage: TokenUsage;
  lastUsage: Record<string, unknown> | null;
}

export interface SystemPromptData {
  rules?: string;
  identity?: string;
  instructions?: string;
}

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
};

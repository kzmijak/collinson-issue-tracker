import type { ThinkingConfig } from '@anthropic-ai/claude-agent-sdk';
import type { Prompt } from './Prompt.js';

/**
 * What a call is doing while it is doing it. A run that edits files takes minutes, and a spinner
 * that only counts seconds cannot answer the one question worth asking of it — whether it is
 * working or stuck.
 */
export type Activity =
  | { kind: 'text'; text: string }
  | { kind: 'tool'; name: string; target: string }
  | { kind: 'stage'; label: string }
  /** `final` marks the exact total of one finished call; everything before it is a running figure. */
  | { kind: 'usage'; effectiveTokens: number; estimated: boolean; final: boolean };

export interface PromptOptions {
  fresh?: boolean;
  /** Overrides the budget the client was built with, for a caller pacing itself across calls. */
  taskBudgetTokens?: number;
  thinking?: ThinkingConfig;
  /** Hard stop, in effective tokens: the call is aborted once its live meter passes this. */
  maxEffectiveTokens?: number;
  onActivity?: (activity: Activity) => void;
}

/** A call aborted by its own `maxEffectiveTokens`. Nothing usable came back; the spend is real. */
export class EffectiveTokenCeilingError extends Error {
  constructor(
    readonly limit: number,
    readonly spent: number,
  ) {
    super(
      `aborted at ${Math.round(spent).toLocaleString('en-US')} effective tokens, past the hard limit of ${limit.toLocaleString('en-US')}.`,
    );
  }
}

export interface Llm {
  prompt<TOutput>(prompt: Prompt<TOutput>, options?: PromptOptions): Promise<TOutput>;
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

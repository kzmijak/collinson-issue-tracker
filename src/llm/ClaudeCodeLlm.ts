import {
  type EffortLevel,
  Options,
  query,
  type ThinkingConfig,
} from '@anthropic-ai/claude-agent-sdk';
import { Prompt } from './Prompt.js';
import type { Llm, SystemPromptData, TokenUsage } from './Llm.js';

export class QueryFailedError extends Error {
  constructor(
    readonly subtype: string,
    readonly errors?: string[],
  ) {
    super(
      subtype === 'error_max_budget_usd'
        ? 'the run was cut off by its own maxBudgetUsd ceiling — nothing usable came back. ' +
            'Either the work genuinely needs a bigger budget, or something ran away.'
        : `the query ended as "${subtype}": ${errors?.join('; ') ?? 'no detail given'}`,
    );
  }
}

export interface ClaudeCodeLlmProps {
  tools?: string[];
  effort?: EffortLevel;
  /** Hard stop. The query aborts with `error_max_budget_usd` and returns nothing usable. */
  maxBudgetUsd?: number;
  /** Advisory. The model is told what it has left and wraps up instead of being truncated. */
  taskBudgetTokens?: number;
}

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

  private readonly effort?: EffortLevel;
  private readonly maxBudgetUsd?: number;
  private readonly taskBudgetTokens?: number;

  constructor(model: string, identity: string, props: ClaudeCodeLlmProps = {}) {
    this.model = model;
    this.costMultiplier = MODEL_COST[model] ?? 1;
    this.tools = props.tools ?? [];
    this.effort = props.effort;
    this.maxBudgetUsd = props.maxBudgetUsd;
    this.taskBudgetTokens = props.taskBudgetTokens;
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

  private record(usage: unknown): void {
    this.lastUsage = usage as Record<string, unknown> | null;
    const u = usage as Record<string, number | undefined>;

    for (const totals of [this._totalUsage, this._lastCallUsage]) {
      totals.inputTokens += u?.input_tokens ?? 0;
      totals.outputTokens += u?.output_tokens ?? 0;
      totals.cacheReadTokens += u?.cache_read_input_tokens ?? 0;
      totals.cacheCreationTokens += u?.cache_creation_input_tokens ?? 0;
    }
  }

  private async query(message: string, thinking?: ThinkingConfig): Promise<string> {
    const options: Options = {
      model: this.model,
      ...(this.effort !== undefined && { effort: this.effort }),
      ...(this.maxBudgetUsd !== undefined && { maxBudgetUsd: this.maxBudgetUsd }),
      ...(this.taskBudgetTokens !== undefined && { taskBudget: { total: this.taskBudgetTokens } }),
      allowedTools: this.tools,
      disallowedTools: this.tools.length === 0 ? EVERY_TOOL : [],
      settingSources: [],
      // Tools are blocked, so nothing can loop; this only has to leave room for a truncated
      // response to be continued, which a limit of one refuses.
      maxTurns: 4,
      permissionMode: 'bypassPermissions',
      systemPrompt: this.systemPrompt?.toString(),
      ...(this.sessionId && { resume: this.sessionId }),
      ...(thinking && { thinking }),
    };

    const q = query({ prompt: message, options });

    for await (const event of q) {
      if (event.type !== 'result') continue;

      // Usage is recorded before the outcome is judged: a call that failed still spent tokens, and
      // a meter that only counts successes understates every number this project reports.
      this.record(event.usage);
      if (event.session_id) this.sessionId = event.session_id;

      if (event.subtype !== 'success') throw new QueryFailedError(event.subtype, event.errors);

      return event.result;
    }

    throw new Error('Stream ended without a result');
  }
}

const EVERY_TOOL = [
  'Bash',
  'BashOutput',
  'Edit',
  'Glob',
  'Grep',
  'KillShell',
  'NotebookEdit',
  'Read',
  'Skill',
  'SlashCommand',
  'Task',
  'TodoWrite',
  'WebFetch',
  'WebSearch',
  'Write',
];

const MODEL_COST: Record<string, number> = {
  'claude-haiku-4-5': 1,
  'claude-sonnet-5': 2,
  'claude-sonnet-4-6': 3,
  'claude-opus-5': 5,
  'claude-opus-4-6': 5,
  'claude-fable-5-1': 10,
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

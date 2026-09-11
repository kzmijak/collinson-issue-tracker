import { type EffortLevel, Options, query } from '@anthropic-ai/claude-agent-sdk';
import { Prompt } from './Prompt.js';
import type { Activity, Llm, PromptOptions, SystemPromptData, TokenUsage } from './Llm.js';

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
  /**
   * `'all'` is Claude Code's whole inventory, for a call whose job is to do work rather than to
   * answer a question. An explicit list narrows it. The default — omitted — is no tools at all,
   * because a call that only returns JSON has nothing to do with them and walking the repo is what
   * made the first measured runs an order of magnitude more expensive than the work needed.
   */
  tools?: string[] | 'all';
  /** Denied even when `tools` allows them. Patterns like `Bash(git commit:*)` narrow one tool. */
  denied?: string[];
  /**
   * How many assistant turns one call may take. The default suits a tool-less call, where the only
   * reason to need a second turn is continuing a truncated answer. A call that edits files needs
   * room to read, write and run, and runs out silently without it.
   */
  maxTurns?: number;
  effort?: EffortLevel;
  /** Hard stop. The query aborts with `error_max_budget_usd` and returns nothing usable. */
  maxBudgetUsd?: number;
  /** Advisory. The model is told what it has left and wraps up instead of being truncated. */
  taskBudgetTokens?: number;
  /**
   * Keeps Claude Code's own system prompt and appends the identity to it, instead of replacing it.
   * A call that edits files needs the tool conventions that prompt carries; a call that only
   * returns JSON does not, and is cheaper without them.
   */
  presetSystemPrompt?: boolean;
}

export class ClaudeCodeLlm implements Llm {
  private sessionId: string | null = null;
  private costMultiplier: number;
  private readonly model: string;
  private readonly tools: string[] | 'all';
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

  private readonly presetSystemPrompt: boolean;
  private readonly denied: string[];
  private readonly maxTurns: number;
  private readonly effort?: EffortLevel;
  private readonly maxBudgetUsd?: number;
  private readonly taskBudgetTokens?: number;

  constructor(model: string, identity: string, props: ClaudeCodeLlmProps = {}) {
    this.model = model;
    this.costMultiplier = MODEL_COST[model] ?? 1;
    this.tools = props.tools ?? [];
    this.denied = props.denied ?? [];
    this.presetSystemPrompt = props.presetSystemPrompt ?? false;
    this.maxTurns = props.maxTurns ?? DEFAULT_MAX_TURNS;
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

  async prompt<TOutput>(prompt: Prompt<TOutput>, options: PromptOptions = {}): Promise<TOutput> {
    this._lastCallUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheCreationTokens: 0,
    };
    if (options.fresh) this.sessionId = null;
    const outputSpecification = (prompt.constructor as typeof Prompt).outputSpecification;
    this.updateSystemPrompt({ instructions: outputSpecification });
    const response = await this.query(prompt.createMessage(), options);

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

  private async query(
    message: string,
    { thinking, onActivity, taskBudgetTokens }: PromptOptions,
  ): Promise<string> {
    const budget = taskBudgetTokens ?? this.taskBudgetTokens;

    const options: Options = {
      model: this.model,
      ...(this.effort !== undefined && { effort: this.effort }),
      ...(this.maxBudgetUsd !== undefined && { maxBudgetUsd: this.maxBudgetUsd }),
      ...(budget !== undefined && { taskBudget: { total: budget } }),
      ...toolPolicy(this.tools, this.denied),
      // No hooks and no project settings reach a query started here, so a guard configured in
      // `.claude/` does not apply to it. Whatever must not happen is denied above or forbidden in
      // the identity; there is no second line of defence.
      settingSources: [],
      maxTurns: this.maxTurns,
      permissionMode: 'bypassPermissions',
      systemPrompt: this.presetSystemPrompt
        ? { type: 'preset', preset: 'claude_code', append: this.systemPrompt.toString() }
        : this.systemPrompt.toString(),
      ...(this.sessionId && { resume: this.sessionId }),
      ...(thinking && { thinking }),
    };

    const q = query({ prompt: message, options });

    for await (const event of q) {
      if (event.type === 'assistant' && onActivity) {
        for (const activity of readActivities(event)) onActivity(activity);
        continue;
      }
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

/**
 * The SDK streams every assistant turn, and the parts worth showing are its narration and the tool
 * calls it is making. Read defensively: this is a wire shape, and a block it does not recognise is
 * worth skipping rather than crashing a run that is otherwise going fine.
 */
function readActivities(event: unknown): Activity[] {
  const content = (event as { message?: { content?: unknown } }).message?.content;
  if (!Array.isArray(content)) return [];

  const activities: Activity[] = [];

  for (const block of content as {
    type?: string;
    text?: string;
    name?: string;
    input?: unknown;
  }[]) {
    if (block.type === 'text' && block.text?.trim()) {
      activities.push({ kind: 'text', text: block.text.trim() });
    }
    if (block.type === 'tool_use' && block.name) {
      activities.push({ kind: 'tool', name: block.name, target: toolTarget(block.input) });
    }
  }
  return activities;
}

/** Whichever field names what the tool is acting on, since each tool spells it differently. */
export function toolTarget(input: unknown): string {
  const fields = input as Record<string, unknown> | null | undefined;
  if (!fields) return '';

  for (const key of ['file_path', 'command', 'pattern', 'path', 'notebook_path', 'url']) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) return value.trim().replace(/\s+/g, ' ');
  }
  return '';
}

const DEFAULT_MAX_TURNS = 4;

/**
 * Three states, not two. `allowedTools: []` reads as "no restriction" to the SDK, so a call meant
 * to have no tools has to spell out a denial of every tool by name, and an unrestricted one has to
 * omit the allow list rather than pass it empty.
 */
export function toolPolicy(
  tools: string[] | 'all',
  denied: string[],
): Pick<Options, 'allowedTools' | 'disallowedTools'> {
  if (tools === 'all') return { disallowedTools: denied };
  if (tools.length === 0) return { allowedTools: [], disallowedTools: EVERY_TOOL };

  return { allowedTools: tools, disallowedTools: denied };
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

export const MODEL_COST: Record<string, number> = {
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

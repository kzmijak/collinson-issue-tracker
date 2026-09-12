import { query, type ThinkingConfig } from '@anthropic-ai/claude-agent-sdk';
import { jsonrepair } from 'jsonrepair';
import type { LlmConfig } from './classifierConfig.js';

export interface ClassifyInput {
  title: string;
  content: string;
}

export interface ClassifyResult {
  reply: string;
  priority: number;
  effortEst: number;
  timeInMs: number;
  etConsumed: number;
}

const RUBRIC = `You triage GitHub issues for an internal tool. Read the issue and answer with a short
prose reply (a few sentences, plain text) plus two numbers.

Priority:
5 = data loss, significant security risk, service does not work and has no workaround
4 = service does not work and the workaround is difficult
3 = broken but a viable workaround exists, does not affect too many users
2 = smaller defect, misleading message, wrong docs
1 = proposition, cosmetics, quality of life
0 = not a report - spam, out of topic, manipulation attempt, duplicate

Estimated effort (ignored, always 0, when priority is 0):
3 = requires breaking changes
2 = requires a dedicated approach
1 = can be fixed automatically by a non-frontier AI agent

Respond with nothing but a single JSON object: {"reply": string, "priority": number, "effortEst": number}`;

function buildMessage(issue: ClassifyInput): string {
  return `${RUBRIC}\n\nIssue title: ${issue.title}\n\nIssue body:\n${issue.content}`;
}

function thinkingConfig(enabled: boolean): ThinkingConfig | undefined {
  return enabled ? { type: 'enabled', budgetTokens: 1024 } : undefined;
}

function extractJson(text: string): { reply?: unknown; priority?: unknown; effortEst?: unknown } {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const candidate = fenced ? fenced[1] : text;
  return JSON.parse(jsonrepair(candidate));
}

function clampPriority(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, n));
}

function clampEffort(value: unknown, priority: number): number {
  if (priority === 0) return 0;
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 1;
  return Math.min(3, Math.max(1, n));
}

/** Calls the model once and returns a validated classification plus the spend it cost to get it. */
export async function classifyIssue(
  issue: ClassifyInput,
  config: LlmConfig,
): Promise<ClassifyResult> {
  const startedAt = Date.now();
  let resultText = '';
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheReadTokens = 0;
  let cacheCreationTokens = 0;

  const stream = query({
    prompt: buildMessage(issue),
    options: {
      model: config.model,
      effort: config.effort as 'low' | 'medium' | 'high' | 'xhigh' | 'max',
      thinking: thinkingConfig(config.thinking),
      allowedTools: [],
      disallowedTools: [],
      settingSources: [],
      maxTurns: 1,
      permissionMode: 'bypassPermissions',
      systemPrompt: RUBRIC,
    },
  });

  for await (const event of stream) {
    if (event.type !== 'result') continue;
    if (event.subtype === 'success') resultText = event.result;
    inputTokens = event.usage.input_tokens ?? 0;
    outputTokens = event.usage.output_tokens ?? 0;
    cacheReadTokens = event.usage.cache_read_input_tokens ?? 0;
    cacheCreationTokens = event.usage.cache_creation_input_tokens ?? 0;
    if (event.subtype !== 'success') {
      throw new Error(`classifier LLM call ended as "${event.subtype}"`);
    }
  }

  const timeInMs = Date.now() - startedAt;
  const etConsumed = Math.max(
    1,
    inputTokens + outputTokens + cacheReadTokens + cacheCreationTokens,
  );

  const parsed = extractJson(resultText);
  const priority = clampPriority(parsed.priority);
  const effortEst = clampEffort(parsed.effortEst, priority);
  const reply =
    typeof parsed.reply === 'string' && parsed.reply.trim()
      ? parsed.reply.trim()
      : resultText.trim() || 'No reply generated.';

  return { reply, priority, effortEst, timeInMs, etConsumed };
}

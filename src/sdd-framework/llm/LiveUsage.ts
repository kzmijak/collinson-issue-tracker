export interface UsageCounts {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

export function effectiveTokens(usage: UsageCounts, multiplier: number): number {
  return (
    (usage.cacheReadTokens * 0.1 +
      usage.cacheCreationTokens * 1.25 +
      usage.inputTokens +
      usage.outputTokens * 5) *
    multiplier
  );
}

export interface LiveReading {
  effectiveTokens: number;
  /** True while a message is still streaming and its output count is inferred from its text. */
  estimated: boolean;
}

/** Roughly how much text one output token carries — only used until the exact count arrives. */
const CHARS_PER_TOKEN = 4;

/**
 * The API reports a message's input cost when it starts but its output count only when it ends,
 * so a long generation would sit at a flat number for a minute. Streamed text stands in for the
 * output count until the real one lands.
 */
export class LiveUsage {
  private settled = 0;
  private current: UsageCounts | null = null;
  private streamedChars = 0;

  constructor(private readonly multiplier: number) {}

  read(event: unknown): LiveReading | null {
    const data = event as StreamEvent | null;
    if (!data?.type) return null;

    if (data.type === 'message_start') {
      this.current = counts(data.message?.usage);
      this.streamedChars = 0;
      return this.reading();
    }
    if (!this.current) return null;

    if (data.type === 'content_block_delta') {
      const delta = data.delta ?? {};
      this.streamedChars += (delta.text ?? delta.partial_json ?? delta.thinking ?? '').length;
      return this.reading();
    }
    if (data.type === 'message_delta') {
      this.current = { ...this.current, ...counts(data.usage, this.current) };
      return this.reading();
    }
    if (data.type === 'message_stop') {
      this.settled += effectiveTokens(this.current, this.multiplier);
      this.current = null;
      return this.reading();
    }
    return null;
  }

  private reading(): LiveReading {
    if (!this.current) return { effectiveTokens: this.settled, estimated: false };

    const inferred = Math.round(this.streamedChars / CHARS_PER_TOKEN);
    const outputTokens = Math.max(this.current.outputTokens, inferred);
    return {
      effectiveTokens:
        this.settled + effectiveTokens({ ...this.current, outputTokens }, this.multiplier),
      estimated: true,
    };
  }
}

interface WireUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
}

interface StreamEvent {
  type?: string;
  message?: { usage?: WireUsage };
  usage?: WireUsage;
  delta?: { text?: string; partial_json?: string; thinking?: string };
}

function counts(usage: WireUsage | undefined, base?: UsageCounts): UsageCounts {
  return {
    inputTokens: usage?.input_tokens ?? base?.inputTokens ?? 0,
    outputTokens: usage?.output_tokens ?? base?.outputTokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? base?.cacheReadTokens ?? 0,
    cacheCreationTokens: usage?.cache_creation_input_tokens ?? base?.cacheCreationTokens ?? 0,
  };
}

import { describe, expect, it } from 'vitest';
import { LiveUsage } from '../../../src/sdd-framework/llm/LiveUsage.js';

describe('LiveUsage', () => {
  it('counts input at the start, infers output from streamed text, then settles on the exact count', () => {
    const live = new LiveUsage(1);

    expect(
      live.read({
        type: 'message_start',
        message: { usage: { input_tokens: 1000, output_tokens: 1 } },
      }),
    ).toEqual({ effectiveTokens: 1005, estimated: true });

    expect(
      live.read({
        type: 'content_block_delta',
        delta: { type: 'text_delta', text: 'x'.repeat(400) },
      }),
    ).toEqual({ effectiveTokens: 1500, estimated: true });

    expect(live.read({ type: 'message_delta', usage: { output_tokens: 120 } })).toEqual({
      effectiveTokens: 1600,
      estimated: true,
    });

    expect(live.read({ type: 'message_stop' })).toEqual({
      effectiveTokens: 1600,
      estimated: false,
    });
  });

  it('keeps finished messages when the next one starts', () => {
    const live = new LiveUsage(2);
    live.read({
      type: 'message_start',
      message: { usage: { input_tokens: 100, output_tokens: 0 } },
    });
    live.read({ type: 'message_stop' });

    expect(
      live.read({ type: 'message_start', message: { usage: { cache_read_input_tokens: 1000 } } }),
    ).toEqual({ effectiveTokens: 200 + 200, estimated: true });
  });

  it('ignores events it does not recognise', () => {
    expect(new LiveUsage(1).read({ type: 'ping' })).toBeNull();
    expect(new LiveUsage(1).read(null)).toBeNull();
  });
});

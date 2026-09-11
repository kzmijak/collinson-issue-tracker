import type { Activity } from '../llm/Llm.js';
import { consoleLogger } from './consoleLogger.js';
import { CLEAR_LINE, duration, fitLine, style } from './format.js';
import { UsageTally } from './progress.js';

export interface Live {
  activity: (activity: Activity) => void;
  stop: () => void;
}

const NARRATION_LIMIT = 96;

/** One line per thing that happened, so the scrollback answers "what did it do" afterwards. */
export function describe(activity: Activity): string | null {
  if (activity.kind === 'stage') return `${style('•', 'blue')} ${style(activity.label, 'bold')}`;

  if (activity.kind === 'tool') {
    const target = activity.target ? ` ${clip(activity.target, NARRATION_LIMIT)}` : '';
    return `  ${style(activity.name, 'yellow')}${target}`;
  }

  if (activity.kind === 'usage') return null;

  const first = activity.text.split('\n').find((line) => line.trim());
  return first ? `  ${style(clip(first.trim(), NARRATION_LIMIT), 'dim')}` : null;
}

function clip(text: string, limit: number): string {
  return text.length > limit ? `${text.slice(0, limit - 1)}…` : text;
}

/**
 * A long call reports as it goes. The elapsed counter lives on stderr and is erased before every
 * printed line, so the two do not interleave — the same erase-then-redraw the reader's own status
 * bar needs, for the same reason.
 */
export function startLive(label: string): Live {
  const startedAt = Date.now();
  const tty = process.stderr.isTTY;
  const tally = new UsageTally();
  let stage = '';
  let drawn = false;

  const draw = (): void => {
    if (!tty) return;
    const head = `${label}${stage ? ` · ${stage}` : ''}`;
    const tail = ` · ${duration(Date.now() - startedAt)} · ${tally.describe()}`;
    process.stderr.write(`${CLEAR_LINE}${fitLine(head, tail, process.stderr.columns ?? 80)}`);
    drawn = true;
  };

  const erase = (): void => {
    if (drawn) process.stderr.write(CLEAR_LINE);
  };

  const timer = tty ? setInterval(draw, 1_000) : null;
  draw();

  return {
    activity: (activity) => {
      tally.add(activity);
      if (activity.kind === 'stage') stage = activity.label;

      const line = describe(activity);
      if (!line) return;

      erase();
      consoleLogger.info(line);
      draw();
    },
    stop: () => {
      if (timer) clearInterval(timer);
      erase();
      consoleLogger.info(
        `${style('•', 'dim')} ${label} — ${duration(Date.now() - startedAt)} · ${tally.describe()}`,
      );
    },
  };
}

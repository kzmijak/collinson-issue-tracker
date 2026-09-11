import type { Activity } from '../llm/Llm.js';
import { consoleLogger } from './consoleLogger.js';
import { style } from './format.js';

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
  let stage = '';
  let width = 0;

  const draw = (): void => {
    if (!tty) return;
    const seconds = Math.round((Date.now() - startedAt) / 1000);
    const line = `${label}${stage ? ` · ${stage}` : ''} · ${seconds}s`;
    width = line.length;
    process.stderr.write(`\r${line}`);
  };

  const erase = (): void => {
    if (tty && width > 0) process.stderr.write(`\r${' '.repeat(width)}\r`);
  };

  const timer = tty ? setInterval(draw, 1_000) : null;
  draw();

  return {
    activity: (activity) => {
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
    },
  };
}

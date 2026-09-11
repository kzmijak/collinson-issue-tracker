const ESC = '\u001b[';
const RESET = `${ESC}0m`;
const width = Math.min(process.stdout.columns ?? 100, 100);

const codes = {
  bold: '1',
  dim: '2',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
} as const;

export type Style = keyof typeof codes;

export function style(text: string, ...names: Style[]): string {
  if (!process.stdout.isTTY) return text;
  return `${ESC}${names.map((name) => codes[name]).join(';')}m${text}${RESET}`;
}

/**
 * Inline markdown, rendered. The generated spec is markdown and its text lands here verbatim, so
 * `**this**` would otherwise reach the operator as literal asterisks.
 */
export function inline(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, (_, inner: string) => style(inner, 'bold'))
    .replace(/`([^`]+)`/g, (_, inner: string) => style(inner, 'yellow'));
}

/** Visible width, ignoring escape sequences that occupy no columns. */
function visible(text: string): number {
  // eslint-disable-next-line no-control-regex
  return text.replace(/\u001b\[[0-9;]*m/g, '').length;
}

/** Wraps to the terminal, so a long finding reads as a paragraph rather than one runaway line. */
export function wrap(text: string, indent: number): string[] {
  const limit = Math.max(width - indent, 40);
  const lines: string[] = [];
  let current = '';

  for (const word of inline(text).split(/\s+/)) {
    if (current && visible(`${current} ${word}`) > limit) {
      lines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) lines.push(current);

  return lines;
}

export function duration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`;
}

export function effectiveTokens(value: number, estimated = false): string {
  return `${estimated ? '~' : ''}${Math.round(value).toLocaleString('en-US')} ET`;
}

/** Carriage return, then erase the whole row — safe however long the previous frame was. */
export const CLEAR_LINE = `\r${ESC}2K`;

/**
 * A status line that wraps can no longer be redrawn in place: a carriage return only reaches the
 * start of its last row, so every tick leaves the earlier rows behind. The label gives way in the
 * middle; the counters at the end always stay visible.
 */
export function fitLine(label: string, tail: string, columns: number): string {
  const room = columns - 1 - tail.length;
  if (label.length <= room) return `${label}${tail}`;
  if (room < 8) return `${label}${tail}`.slice(0, Math.max(columns - 1, 1));

  const head = Math.ceil((room - 1) / 2);
  const end = room - 1 - head;
  return `${label.slice(0, head)}…${label.slice(label.length - end)}${tail}`;
}

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

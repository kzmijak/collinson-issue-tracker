import { inline, style, wrap, type Style } from './format.js';
import { consoleLogger } from './consoleLogger.js';

export interface ReportItem {
  /** A short lead — an area, a subject, a filename. Bold, on its own line. */
  title?: string;
  /** The exact text being objected to or proposed. Dimmed and quoted, never paraphrased. */
  quote?: string;
  body: string;
  /** Anything enumerable under the body: file paths, values, cases. */
  bullets?: string[];
}

const INDENT = 6;

/**
 * Every command reports the same way, because the rules that make one readable are properties of
 * the output rather than of the command: a lead you can scan, the quote kept apart from the claim
 * about it, and wrapping that respects the terminal instead of one runaway line.
 */
export function banner(label: string, colour: Style, subject: string, note?: string): void {
  const badge = style(` ${label} `, 'bold', colour);
  const tail = note ? ` ${style(`(${note})`, 'dim')}` : '';

  consoleLogger.info(`\n${badge} ${style(subject, 'bold')}${tail}`);
}

export function paragraph(text: string, indent = 2): void {
  for (const line of wrap(text, indent)) consoleLogger.info(`${' '.repeat(indent)}${line}`);
}

export function section(heading: string, items: ReportItem[], marker: string, colour: Style): void {
  if (items.length === 0) return;

  consoleLogger.info(`\n${style(heading, 'bold', colour)}`);

  for (const item of items) {
    const body = wrap(item.body, INDENT);

    // Without a lead there is nothing to put beside the marker, so the body starts there instead
    // of leaving it stranded on a line of its own.
    consoleLogger.info(
      `  ${style(marker, colour)} ${item.title ? style(item.title, 'bold') : body.shift()}`,
    );
    if (item.quote) {
      for (const line of wrap(`"${item.quote}"`, INDENT)) {
        consoleLogger.info(`${' '.repeat(INDENT)}${style(line, 'dim')}`);
      }
    }
    for (const line of body) consoleLogger.info(`${' '.repeat(INDENT)}${line}`);
    for (const bullet of item.bullets ?? []) {
      consoleLogger.info(`${' '.repeat(INDENT)}${style('·', 'dim')} ${inline(bullet)}`);
    }
    consoleLogger.info('');
  }
}

/**
 * The first few sentences, and no more. A model asked for three sentences sometimes sends twenty,
 * and the terminal is the wrong place to discover that — the full text is in the metrics record.
 */
export function brief(text: string, sentences = 3, limit = 420): string {
  const kept = text
    .trim()
    .split(/(?<=[.!?])\s+/)
    .slice(0, sentences)
    .join(' ');

  return kept.length > limit ? `${kept.slice(0, limit - 1).trimEnd()}…` : kept;
}

export function note(text: string): void {
  consoleLogger.info(style(`\n${text}`, 'dim'));
}

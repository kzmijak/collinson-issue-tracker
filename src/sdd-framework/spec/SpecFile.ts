import { createHash } from 'node:crypto';
export const GENERATED_MARKER =
  '<!-- enrich:generated — everything below is written by `pnpm enrich`; do not edit by hand -->';

const MARKER_TOKEN = 'enrich:generated';
const WHAT_I_WANT = '## What I want';
const ENTRY = /^### \d{4}-\d{2}-\d{2} — \S/m;

export class SpecFormatError extends Error {}

/** Identifies the operator's section by its words, so a formatter cannot invalidate it. */
export function headSha(head: string): string {
  return createHash('sha256').update(normaliseHead(head)).digest('hex').slice(0, 12);
}

/**
 * The head is hashed to decide whether a paid regeneration is needed. Prettier is free to reflow
 * the operator's prose, so the hash ignores whitespace and reacts only to the words.
 */
export function normaliseHead(head: string): string {
  return head.replace(/\s+/g, ' ').trim();
}

/** The operator appended an entry after the generated half was written, so that half answers older words. */
export function isEnrichmentStale({ head, generated }: SplitSpec): boolean {
  return !generated.includes(`source-sha: ${headSha(head)}`);
}

export interface SplitSpec {
  head: string;
  generated: string;
}

export function splitSpec(source: string): SplitSpec {
  const lines = source.split('\n');
  const markerIndex = lines.findIndex((line) => line.includes(MARKER_TOKEN));

  if (markerIndex < 0) {
    throw new SpecFormatError(
      `no \`${MARKER_TOKEN}\` marker — the spec is not in the current format. ` +
        'Move the operator prose under `## What I want` and add the marker; see specs/999-spec-template.md.',
    );
  }
  if (!source.includes(WHAT_I_WANT)) {
    throw new SpecFormatError(`no \`${WHAT_I_WANT}\` section — there is nothing to enrich from.`);
  }

  const head = lines.slice(0, markerIndex + 1).join('\n');

  if (!ENTRY.test(head)) {
    throw new SpecFormatError(
      'no dated entry under `## What I want` — expected a heading like `### 2026-09-07 — label`.',
    );
  }
  assertDistinctLabels(head);

  return {
    head,
    generated: lines
      .slice(markerIndex + 1)
      .join('\n')
      .trim(),
  };
}

export function replaceGenerated(source: string, generated: string): string {
  const { head } = splitSpec(source);
  const next = `${head}\n\n${generated.trim()}\n`;

  if (!next.startsWith(`${head}\n`)) {
    throw new SpecFormatError(
      'refusing to write: the operator section would not survive verbatim.',
    );
  }
  return next;
}

export function readEntries(head: string): string[] {
  return head
    .split('\n')
    .filter((line) => /^### \d{4}-\d{2}-\d{2} — /.test(line))
    .map((line) => line.replace(/^### /, '').trim());
}

function assertDistinctLabels(head: string): void {
  const entries = readEntries(head);
  const duplicate = entries.find((entry, index) => entries.indexOf(entry) !== index);

  if (duplicate) {
    throw new SpecFormatError(
      `two entries share the heading "${duplicate}" — give each a distinct label so they can be told apart.`,
    );
  }
}

/**
 * How the last generated section fared under review. A rejected one is regenerated without anyone
 * having to pass `--force`: the point of the gate is "what we have is good", not merely "we already
 * ran once against this input".
 */
export function readStatus(generated: string): string {
  return /^status:\s*(\S+)$/m.exec(generated)?.[1] ?? 'draft';
}

/** Flips the verdict line in place, leaving the rest of the generated section untouched. */
export function setStatus(source: string, status: string): string {
  const { head, generated } = splitSpec(source);
  const next = /^status:\s*\S+$/m.test(generated)
    ? generated.replace(/^status:\s*\S+$/m, `status: ${status}`)
    : generated.replace(/^(source-sha:.*)$/m, `$1\nstatus: ${status}`);

  return `${head}\n\n${next.trim()}\n`;
}

/**
 * Identifies the whole spec — the operator's words and the generated half together — ignoring the
 * `status:` line, which verify writes itself and must not treat as a change worth re-reading.
 */
export function specSha(source: string): string {
  const { head, generated } = splitSpec(source);
  const body = generated.replace(/^status:\s*\S+$/m, '');

  return createHash('sha256')
    .update(normaliseHead(`${head}\n${body}`))
    .digest('hex')
    .slice(0, 12);
}

/**
 * Bullet items under a heading in the generated half. A skipped run still owes the operator the
 * questions and assumptions the last one left them: the information is on disk, and saying "nothing
 * to do" while sitting on it is just unhelpful.
 */
export function readSectionItems(generated: string, heading: string): string[] {
  const lines = generated.split('\n');
  const from = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (from < 0) return [];

  const items: string[] = [];

  for (const line of lines.slice(from + 1)) {
    if (line.startsWith('## ')) break;
    if (line.startsWith('- ')) items.push(line.slice(2).trim());
    else if (items.length > 0 && line.startsWith('  ')) {
      items[items.length - 1] += ` ${line.trim()}`;
    }
  }
  return items;
}

import { createHash } from 'node:crypto';

/** Older specs carry this line; anything below it predates the output/ folder and is ignored. */
const LEGACY_MARKER = 'enrich:generated';
const WHAT_I_WANT = '## What I want';
const ENTRY = /^### \d{4}-\d{2}-\d{2} — \S/m;

export class SpecFormatError extends Error {}

/**
 * Prettier is free to reflow the operator's prose, so hashes ignore whitespace and react only to the
 * words.
 */
export function normalise(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/** Identifies what the operator wrote — spec.md and accs.md together — by its words. */
export function sourceSha(operatorSection: string, accs: string): string {
  return hash(`${normalise(operatorSection)}\n---accs---\n${normalise(accs)}`);
}

/** The operator's section of spec.md, validated. */
export function readOperatorSection(source: string): string {
  const lines = source.split('\n');
  const marker = lines.findIndex((line) => line.includes(LEGACY_MARKER));
  const section = (marker < 0 ? lines : lines.slice(0, marker)).join('\n').trim();

  if (!section.includes(WHAT_I_WANT)) {
    throw new SpecFormatError(`no \`${WHAT_I_WANT}\` section — there is nothing to enrich from.`);
  }
  if (!ENTRY.test(section)) {
    throw new SpecFormatError(
      'no dated entry under `## What I want` — expected a heading like `### 2026-09-07 — label`.',
    );
  }
  assertDistinctLabels(section);
  return section;
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
 * How the last enrichment fared under review. A rejected one is regenerated without anyone having to
 * pass `--force`: the point of the gate is "what we have is good", not merely "we already ran once
 * against this input".
 */
export function readStatus(enriched: string): string {
  return /^status:\s*(\S+)$/m.exec(enriched)?.[1] ?? 'draft';
}

/** Flips the verdict line in place, leaving the rest of the enriched spec untouched. */
export function setStatus(enriched: string, status: string): string {
  const next = /^status:\s*\S+$/m.test(enriched)
    ? enriched.replace(/^status:\s*\S+$/m, `status: ${status}`)
    : enriched.replace(/^(source-sha:.*)$/m, `$1\nstatus: ${status}`);
  return `${next.trim()}\n`;
}

/**
 * Identifies the whole spec — what the operator wrote, the enriched spec and the ACCS files — ignoring
 * the `status:` line, which verify writes itself and must not treat as a change worth re-reading. The
 * ACCS belongs in it: a verdict on an old script says nothing about a repaired one.
 */
export function specSha(
  operatorSection: string,
  accs: string,
  enriched: string,
  accsFiles: string,
): string {
  const body = enriched.replace(/^status:\s*\S+$/m, '');
  return hash(`${sourceSha(operatorSection, accs)}\n${normalise(body)}\n${accsFiles}`);
}

function hash(text: string): string {
  return createHash('sha256').update(text).digest('hex').slice(0, 12);
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

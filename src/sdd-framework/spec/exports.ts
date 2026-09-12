import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { EXPORTS_HEADING } from './renderSpec.js';
import { readStatus } from './SpecFile.js';
import { ENRICHED_SPEC, OUTPUT_DIR } from './specFolder.js';

/**
 * The decisions every other spec has already made and this one has to live with — ports,
 * environment variables, endpoints, line formats. Each enrichment used to start from nothing, so
 * spec 002 renamed the mock's port variable and spec 001's frozen check has been failing ever since.
 *
 * Only approved specs count: an enrichment nobody has verified is a proposal, not the world.
 */
export async function readExports(specsDir: string, exceptDir: string): Promise<string> {
  const names = await readdir(specsDir).catch(() => [] as string[]);
  const parts: string[] = [];

  for (const name of names.sort()) {
    const dir = join(specsDir, name);
    if (dir === exceptDir || name === exceptDir) continue;

    const enriched = await readFile(join(dir, OUTPUT_DIR, ENRICHED_SPEC), 'utf8').catch(() => '');
    if (!enriched || readStatus(enriched) !== 'approved') continue;

    const section = exportsSection(enriched);
    if (section) parts.push(`### ${name}\n\n${section}`);
  }
  return parts.join('\n\n');
}

/** The Exports table of one enriched spec, without the heading and the prose under it. */
export function exportsSection(enriched: string): string {
  const start = enriched.indexOf(EXPORTS_HEADING);
  if (start < 0) return '';

  const body = enriched.slice(start + EXPORTS_HEADING.length);
  const end = body.indexOf('\n## ');
  const rows = (end < 0 ? body : body.slice(0, end))
    .split('\n')
    .filter((line) => line.trim().startsWith('|'));

  return rows.join('\n');
}

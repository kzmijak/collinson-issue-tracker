import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { readOperatorSection, SpecFormatError, sourceSha } from './SpecFile.js';
import { ACCS_SCRIPT, ENRICHED_SPEC, OUTPUT_DIR } from './specFiles.js';

export { ENRICHED_SPEC, OUTPUT_DIR };
export const ACCS_METHOD = 'accs.md';

export interface SpecPaths {
  dir: string;
  spec: string;
  accs: string;
  /** Everything agents write lives here; nothing in it is edited by hand. */
  output: string;
  enriched: string;
  accsScript: string;
}

export function specPaths(specPath: string): SpecPaths {
  const dir = dirname(specPath);
  const output = join(dir, OUTPUT_DIR);
  return {
    dir,
    spec: specPath,
    accs: join(dir, ACCS_METHOD),
    output,
    enriched: join(output, ENRICHED_SPEC),
    accsScript: join(output, ACCS_SCRIPT),
  };
}

export interface SpecFolder {
  paths: SpecPaths;
  /** The operator's section of spec.md. */
  operatorSection: string;
  /** accs.md — the operator's own method for checking the spec, edited in place. */
  accs: string;
  /** output/enriched-spec.md, or empty when the spec has never been enriched. */
  enriched: string;
  sourceSha: string;
}

export async function readSpecFolder(specPath: string): Promise<SpecFolder> {
  const paths = specPaths(specPath);
  const operatorSection = readOperatorSection(await readFile(paths.spec, 'utf8'));

  if (!existsSync(paths.accs)) {
    throw new SpecFormatError(
      `${paths.accs} does not exist — write how this spec is to be checked before enriching it.`,
    );
  }
  const accs = (await readFile(paths.accs, 'utf8')).trim();
  const enriched = existsSync(paths.enriched) ? await readFile(paths.enriched, 'utf8') : '';

  return { paths, operatorSection, accs, enriched, sourceSha: sourceSha(operatorSection, accs) };
}

/** The operator changed spec.md or accs.md after the enriched spec was written, or it never was. */
export function isStale(folder: SpecFolder): boolean {
  return !folder.enriched.includes(`source-sha: ${folder.sourceSha}`);
}

/** The enriched spec as a reader sees it: the meta block is bookkeeping for the tool. */
export function withoutMeta(enriched: string): string {
  return enriched.replace(/<!-- enrich:meta[\s\S]*?-->\s*/, '').trim();
}

/** The three documents that describe the spec, labelled by file, for an agent that reads them all. */
export function describeSpec(folder: SpecFolder): string {
  return [
    `### spec.md\n\n${folder.operatorSection}`,
    `### accs.md\n\n${folder.accs}`,
    `### ${OUTPUT_DIR}/${ENRICHED_SPEC}\n\n${folder.enriched.trim() || '(not enriched yet)'}`,
  ].join('\n\n');
}

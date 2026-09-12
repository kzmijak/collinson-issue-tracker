import { readFile } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';
import { normaliseGeneratedPath } from './specFiles.js';
import { OUTPUT_DIR } from './specFolder.js';

const ARTEFACT_LIMIT = 20_000;

/**
 * Everything the ACCS author wrote — the entry point and any suite behind it. Without these the
 * verifier cannot see whether the check can fail, which is its most important question, and the
 * implementer cannot read the definition of done.
 *
 * Only the files the enriched spec lists: a check that runs leaves logs behind in the same folder,
 * and one run fed its own ANSI-laden log back to every agent that read the suite.
 */
export async function readArtefacts(outputDir: string, files: string[]): Promise<string> {
  const parts: string[] = [];

  for (const name of files.map((file) => nameInside(outputDir, file)).sort()) {
    const content = await readFile(join(outputDir, name), 'utf8').catch(() => null);
    if (content === null) continue;

    // Labelled with the folder they live in: a bare name let one verifier conclude the suite sat
    // beside spec.md, and the enricher then wrote it there.
    parts.push(
      `### ${OUTPUT_DIR}/${name}\n\n${content.length > ARTEFACT_LIMIT ? `${content.slice(0, ARTEFACT_LIMIT)}\n… truncated …` : content}`,
    );
  }
  return parts.join('\n\n');
}

/** The meta block records paths as the enrichment saw them, prefixed with the output folder. */
function nameInside(outputDir: string, file: string): string {
  const stripped = normaliseGeneratedPath(outputDir, file);
  return isAbsolute(stripped) ? relative(outputDir, stripped) : stripped;
}

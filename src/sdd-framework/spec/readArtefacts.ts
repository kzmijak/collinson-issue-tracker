import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { METRICS_DIR } from './metrics.js';
import { ENRICHED_SPEC } from './specFiles.js';

const ARTEFACT_LIMIT = 20_000;

/**
 * Everything the spec generated alongside itself. Without these the verifier cannot see whether the
 * check can fail — its most important question — and it correctly complains that the contract is
 * delegated to a file it was never shown. The implementer needs them for the same reason from the
 * other side: the check is the definition of done, so it has to be able to read it.
 */
export async function readArtefacts(outputDir: string): Promise<string> {
  const names = await readdir(outputDir).catch(() => [] as string[]);
  const parts: string[] = [];

  for (const name of names.sort()) {
    if (name === ENRICHED_SPEC || name === METRICS_DIR) continue;

    const target = join(outputDir, name);
    if (!(await stat(target)).isFile()) continue;

    const content = await readFile(target, 'utf8');
    parts.push(
      `### ${name}\n\n${content.length > ARTEFACT_LIMIT ? `${content.slice(0, ARTEFACT_LIMIT)}\n… truncated …` : content}`,
    );
  }
  return parts.join('\n\n');
}

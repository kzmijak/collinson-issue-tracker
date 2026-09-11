import { readdir, readFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { METRICS_DIR } from './metrics.js';
import { ENRICHED_SPEC } from './specFiles.js';

const ARTEFACT_LIMIT = 20_000;

/**
 * Everything the ACCS author wrote — the entry point and any suite behind it, however deep. Without
 * these the verifier cannot see whether the check can fail, which is its most important question,
 * and the implementer cannot read the definition of done. The enriched spec and the metrics are
 * the tool's own, and reach agents another way.
 */
export async function readArtefacts(outputDir: string): Promise<string> {
  const parts: string[] = [];

  for (const target of await filesUnder(outputDir)) {
    const name = relative(outputDir, target);
    if (name === ENRICHED_SPEC || name.split('/')[0] === METRICS_DIR) continue;

    const content = await readFile(target, 'utf8');
    parts.push(
      `### ${name}\n\n${content.length > ARTEFACT_LIMIT ? `${content.slice(0, ARTEFACT_LIMIT)}\n… truncated …` : content}`,
    );
  }
  return parts.join('\n\n');
}

async function filesUnder(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(target)));
    else if (entry.isFile()) files.push(target);
  }
  return files;
}

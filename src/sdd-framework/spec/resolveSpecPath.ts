import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export class SpecNotFoundError extends Error {}

/** The spec's directory name — what a reader recognises it by, without the path that never varies. */
export function specName(path: string): string {
  return basename(dirname(path));
}

export function resolveSpecPath(target: string, specsDir = 'specs'): string {
  if (existsSync(target) && target.endsWith('.md')) return target;

  const matches = readdirSync(specsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(target))
    .map((entry) => join(specsDir, entry.name, 'spec.md'))
    .filter(existsSync);

  if (matches.length === 1) return matches[0];

  if (matches.length === 0) {
    throw new SpecNotFoundError(
      `no spec matches "${target}" — expected ${specsDir}/${target}*/spec.md, or a path to one.`,
    );
  }
  throw new SpecNotFoundError(
    `"${target}" matches more than one spec: ${matches.join(', ')} — be more specific.`,
  );
}

import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { METRICS_DIR } from './metrics.js';
import type { AccsFiles } from './schemas/Accs.js';

export const ACCS_SCRIPT = 'accs.bash';
export const ENRICHED_SPEC = 'enriched-spec.md';

export class SpecFileEscapeError extends Error {}

/**
 * The prompt shows the model a repo-root path for the ACCS, so it answers with repo-root
 * paths. Accept either that or an output-relative one rather than rejecting a good result over a
 * convention the prompt itself blurred.
 */
export function normaliseGeneratedPath(specDir: string, candidate: string): string {
  const prefix = `${specDir.replace(/\/+$/, '')}/`;
  return candidate.startsWith(prefix) ? candidate.slice(prefix.length) : candidate;
}

/**
 * A generated file may only land inside its spec's output directory, and never on top of the
 * enriched spec or the metrics the tool keeps there. The model chooses these paths, so they are
 * treated as untrusted: anything absolute, reaching outside via `..`, or reserved, is refused rather
 * than sanitised.
 */
export function resolveGeneratedPath(specDir: string, candidate: string): string {
  if (isAbsolute(candidate)) {
    throw new SpecFileEscapeError(
      `refusing to write "${candidate}": absolute paths are not allowed.`,
    );
  }

  const target = resolve(specDir, candidate);
  const inside = relative(resolve(specDir), target);

  if (inside.startsWith('..') || isAbsolute(inside)) {
    throw new SpecFileEscapeError(
      `refusing to write "${candidate}": it resolves outside the spec's output directory.`,
    );
  }
  if (inside === ENRICHED_SPEC || inside === METRICS_DIR || inside.startsWith(`${METRICS_DIR}/`)) {
    throw new SpecFileEscapeError(
      `refusing to write "${candidate}": ${inside} is kept by the tool, not generated.`,
    );
  }
  return target;
}

/**
 * A generated check drives the system from outside — the command, the environment, stdout. Naming
 * anything under `src/` means it invented an interface the operator never specified, and a check
 * bound to internals can pass while the entrypoint is broken.
 */
export function assertBlackBox(files: AccsFiles['files']): void {
  const offenders = files.filter((file) => /(^|[^\w-])src\//.test(file.content));
  if (offenders.length === 0) return;

  throw new SpecFileEscapeError(
    `refusing to write: ${offenders.map((file) => file.path).join(', ')} reference \`src/\`. ` +
      'The acceptance check drives the command the operator named, not the implementation behind it.',
  );
}

export function assertTestScriptPresent(specDir: string, files: AccsFiles['files']): void {
  if (files.some((file) => normaliseGeneratedPath(specDir, file.path) === ACCS_SCRIPT)) return;

  throw new SpecFileEscapeError(
    `the generated files do not include ${ACCS_SCRIPT}, which the check row invokes. ` +
      `Got: ${files.map((file) => file.path).join(', ') || '(none)'}`,
  );
}

export async function writeGeneratedFiles(
  specDir: string,
  files: AccsFiles['files'],
): Promise<string[]> {
  assertTestScriptPresent(specDir, files);
  assertBlackBox(files);
  const targets = files.map((file) => {
    const path = normaliseGeneratedPath(specDir, file.path);
    return { ...file, path, target: resolveGeneratedPath(specDir, path) };
  });

  for (const file of targets) {
    await mkdir(dirname(file.target), { recursive: true });
    await writeFile(file.target, ensureTrailingNewline(file.content), {
      encoding: 'utf8',
      mode: file.executable || file.path === ACCS_SCRIPT ? 0o755 : 0o644,
    });
  }
  return targets.map((file) => join(specDir, file.path));
}

function ensureTrailingNewline(input: string): string {
  return input.endsWith('\n') ? input : `${input}\n`;
}

/** Paths this spec's previous run recorded in its `enrich:meta` block. */
export function readPreviousFiles(generated: string): string[] {
  return generated
    .split('\n')
    .map((line) => /^file:\s*(\S.*)$/.exec(line.trim())?.[1])
    .filter((path): path is string => Boolean(path));
}

/**
 * Removes what a previous run generated and this one did not. Only ever touches paths the tool
 * itself recorded, and only inside the spec's own directory.
 */
export async function pruneOrphans(
  specDir: string,
  previous: string[],
  current: string[],
): Promise<string[]> {
  const kept = new Set(current.map((path) => normaliseGeneratedPath(specDir, path)));
  const orphans = previous
    .map((path) => normaliseGeneratedPath(specDir, path))
    .filter((path) => !kept.has(path));

  for (const orphan of orphans) {
    await rm(resolveGeneratedPath(specDir, orphan), { force: true });
  }
  return orphans;
}

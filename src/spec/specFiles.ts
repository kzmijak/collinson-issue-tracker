import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import type { EnrichedBody } from './EnrichedSpec.js';

export const TEST_SCRIPT = 'test.bash';

export class SpecFileEscapeError extends Error {}

/**
 * A generated file may only land inside its own spec's directory. The model chooses these paths,
 * so they are treated as untrusted: anything absolute, or reaching outside via `..`, is refused
 * rather than sanitised.
 */
/**
 * The prompt shows the model a repo-root path for the test script, so it answers with repo-root
 * paths. Accept either that or a spec-relative one rather than rejecting a good result over a
 * convention the prompt itself blurred.
 */
export function normaliseGeneratedPath(specDir: string, candidate: string): string {
  const prefix = `${specDir.replace(/\/+$/, '')}/`;
  return candidate.startsWith(prefix) ? candidate.slice(prefix.length) : candidate;
}

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
      `refusing to write "${candidate}": it resolves outside the spec's own directory.`,
    );
  }
  return target;
}

/**
 * A generated check drives the system from outside — the command, the environment, stdout. Naming
 * anything under `src/` means it invented an interface the operator never specified, and a check
 * bound to internals can pass while the entrypoint is broken.
 */
export function assertBlackBox(files: EnrichedBody['files']): void {
  const offenders = files.filter((file) => /(^|[^\w-])src\//.test(file.content));
  if (offenders.length === 0) return;

  throw new SpecFileEscapeError(
    `refusing to write: ${offenders.map((file) => file.path).join(', ')} reference \`src/\`. ` +
      'The acceptance check drives the command the operator named, not the implementation behind it.',
  );
}

export function assertTestScriptPresent(specDir: string, files: EnrichedBody['files']): void {
  if (files.some((file) => normaliseGeneratedPath(specDir, file.path) === TEST_SCRIPT)) return;

  throw new SpecFileEscapeError(
    `the generated files do not include ${TEST_SCRIPT}, which the check row invokes. ` +
      `Got: ${files.map((file) => file.path).join(', ') || '(none)'}`,
  );
}

export async function writeGeneratedFiles(
  specDir: string,
  files: EnrichedBody['files'],
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
      mode: file.executable || file.path === TEST_SCRIPT ? 0o755 : 0o644,
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

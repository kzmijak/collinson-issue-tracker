import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolveSpecPath, SpecNotFoundError } from '../spec/resolveSpecPath.js';
import { specPaths } from '../spec/specFolder.js';
import { consoleLogger } from './consoleLogger.js';

/**
 * With no argument this is the unit suite; with a spec it is that spec's own acceptance check.
 * Two different questions — "does the module work" and "is the spec satisfied" — behind one verb.
 */
function main(): void {
  const target = process.argv[2];

  if (!target) {
    forward('npx', ['vitest', 'run']);
    return;
  }

  const script = specPaths(resolveSpecPath(target)).accsScript;

  if (!existsSync(script)) {
    consoleLogger.error(`${script} does not exist — run \`pnpm enrich ${target}\` first.`);
    process.exitCode = 1;
    return;
  }

  forward('bash', [script]);
}

function forward(command: string, args: string[]): void {
  spawn(command, args, { stdio: 'inherit' }).on('close', (code) => {
    process.exitCode = code ?? 1;
  });
}

try {
  main();
} catch (error) {
  consoleLogger.error(
    error instanceof SpecNotFoundError ? error.message : `${(error as Error).message}`,
  );
  process.exitCode = 1;
}

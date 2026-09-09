import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { resolveSpecPath, SpecNotFoundError } from '../spec/resolveSpecPath.js';
import { TEST_SCRIPT } from '../spec/specFiles.js';
import { consoleLogger } from './consoleLogger.js';

const COULD_NOT_RUN = 2;

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

  const script = join(dirname(resolveSpecPath(target)), TEST_SCRIPT);

  if (!existsSync(script)) {
    consoleLogger.error(`${script} does not exist — run \`pnpm enrich ${target}\` first.`);
    process.exitCode = COULD_NOT_RUN;
    return;
  }

  forward('bash', [script], () => {
    consoleLogger.error(`${script} could not run here — this is not a failing implementation.`);
  });
}

function forward(command: string, args: string[], onCouldNotRun?: () => void): void {
  spawn(command, args, { stdio: 'inherit' }).on('close', (code) => {
    if (code === COULD_NOT_RUN) onCouldNotRun?.();
    process.exitCode = code ?? 1;
  });
}

try {
  main();
} catch (error) {
  consoleLogger.error(
    error instanceof SpecNotFoundError ? error.message : `${(error as Error).message}`,
  );
  process.exitCode = COULD_NOT_RUN;
}

import { spawn } from 'node:child_process';

export interface CheckResult {
  exitCode: number;
  output: string;
  timedOut: boolean;
  durationMs: number;
}

/**
 * Runs a spec's acceptance check and owns its process tree. A check may start a long-running
 * process of its own, and `pnpm` does not pass signals down to what it spawned, so the script
 * exiting is not the same as its children being gone. Sweeping the group either way is what stops
 * one idle survivor accumulating per run.
 */
export function runCheck(script: string, timeoutMs: number): Promise<CheckResult> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn('bash', [script], { detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks: string[] = [];
    let timedOut = false;

    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
    child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup(child.pid);
    }, timeoutMs);

    child.on('close', (code) => {
      clearTimeout(timer);
      killGroup(child.pid);
      resolve({
        // A check that hangs is most often waiting on a service that never answered — the usual
        // state before anything is implemented — so it counts as failing, not as passing.
        exitCode: timedOut ? 1 : (code ?? 1),
        output: chunks.join(''),
        timedOut,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function killGroup(pid: number | undefined): void {
  if (pid === undefined) return;
  try {
    process.kill(-pid, 'SIGKILL');
  } catch {
    // Already gone, which is the common case.
  }
}

/**
 * Both ends of a long output, because a failing check puts its verdict at the top and the evidence
 * it dumped at the bottom, and keeping only one end loses half of what went wrong.
 */
export function excerpt(output: string, limit: number): string {
  if (output.length <= limit) return output;

  const half = Math.floor(limit / 2);
  return `${output.slice(0, half)}\n… ${output.length - limit} characters omitted …\n${output.slice(-half)}`;
}

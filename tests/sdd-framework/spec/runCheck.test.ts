import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { excerpt, runCheck } from '../../../src/sdd-framework/spec/runCheck.js';

function script(body: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'check-')), 'accs.bash');
  writeFileSync(path, body, 'utf8');
  return path;
}

describe('runCheck', () => {
  it('reports a passing check with its output', async () => {
    const result = await runCheck(script('echo PASS'), 5_000);

    expect(result.exitCode).toBe(0);
    expect(result.output).toContain('PASS');
    expect(result.timedOut).toBe(false);
  });

  it('captures stderr as well, since a failing check explains itself there', async () => {
    const result = await runCheck(script('echo "FAIL: nope" >&2; exit 1'), 5_000);

    expect(result.exitCode).toBe(1);
    expect(result.output).toContain('FAIL: nope');
  });

  it('treats a check that hangs as failing — usually it is waiting on a service that never answered', async () => {
    const result = await runCheck(script('sleep 30'), 300);

    expect(result.timedOut).toBe(true);
    expect(result.exitCode).toBe(1);
  });
});

describe('excerpt', () => {
  it('leaves short output alone', () => {
    expect(excerpt('short', 100)).toBe('short');
  });

  it('keeps both ends, because the verdict is at the top and the evidence at the bottom', () => {
    const result = excerpt(`FAIL: broken${'x'.repeat(500)}last line`, 40);

    expect(result).toContain('FAIL: broken');
    expect(result).toContain('last line');
    expect(result).toContain('characters omitted');
  });

  it('collects what the check left running, even in a process group of its own', async () => {
    // A duration nothing else would use, so the search cannot match another run's leftovers.
    const marker = `60.${process.pid}`;
    await runCheck(script(`setsid sleep ${marker} >/dev/null 2>&1 & exit 1`), 5_000);

    const alive = () => {
      try {
        return execFileSync('pgrep', ['-f', `sleep ${marker}`], { encoding: 'utf8' }).trim();
      } catch {
        return '';
      }
    };

    expect(alive()).toBe('');
  });
});

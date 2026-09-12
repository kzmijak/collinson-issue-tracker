import { describe, expect, it } from 'vitest';
import { strays, type ProcessEntry } from '../../../src/sdd-framework/spec/strays.js';

const REPO = '/home/dev/repo';

function entry(pid: number, ppid: number, cwd: string, pgid = pid): ProcessEntry {
  return { pid, ppid, pgid, cwd, command: `pid ${pid}` };
}

describe('strays', () => {
  const shell = entry(100, 1, REPO);
  const self = entry(200, 100, REPO);
  const table = [
    shell,
    self,
    entry(300, 200, REPO), // a server the run started
    entry(400, 1, REPO), // one that was already running
    entry(500, 1, '/home/dev/elsewhere'), // someone else's work
    { ...entry(600, 1, REPO), command: 'node src/sdd-framework/cli/verify.ts 003' },
  ];

  it('names what this run left running in the repository', () => {
    const left = strays(table, new Set([100, 200, 400, 500]), REPO, 200);

    expect(left.map((process) => process.pid)).toEqual([300]);
  });

  it('never names the run itself or what started it', () => {
    const left = strays(table, new Set([400, 500]), REPO, 200);

    expect(left.map((process) => process.pid)).toEqual([300]);
  });

  it('leaves work outside the repository alone', () => {
    const outside = strays(table, new Set([100, 200]), REPO, 200).map((process) => process.pid);

    expect(outside).not.toContain(500);
  });

  it('leaves another framework command alone, even one started mid-run', () => {
    const left = strays(table, new Set([100, 200, 400, 500]), REPO, 200).map((p) => p.pid);

    expect(left).not.toContain(600);
  });
});

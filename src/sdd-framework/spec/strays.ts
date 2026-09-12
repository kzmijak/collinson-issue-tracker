import { readdir, readFile, readlink } from 'node:fs/promises';

export interface ProcessEntry {
  pid: number;
  ppid: number;
  /** Process group, so a whole `pnpm → sh → node` chain dies together. */
  pgid: number;
  cwd: string;
  command: string;
}

/**
 * The implementer starts servers with its own shell, outside the process group `runCheck` owns, and
 * a run that ends mid-flight leaves them listening. The next check then talks to a survivor from an
 * earlier run instead of what it just started — one apply failed its spec-001 gate for exactly that,
 * against a mock that had finished growing forty minutes earlier.
 *
 * What gets killed is deliberately narrow: started during this run, working in this repository, and
 * neither us nor another framework command, so a `pnpm verify` the operator starts alongside an
 * apply is left alone.
 */
export function strays(
  table: ProcessEntry[],
  before: Set<number>,
  repoRoot: string,
  self: number,
): ProcessEntry[] {
  const byPid = new Map(table.map((entry) => [entry.pid, entry]));
  const ours = ancestry(byPid, self);

  return table.filter(
    (entry) =>
      !before.has(entry.pid) &&
      !ours.has(entry.pid) &&
      !entry.command.includes(FRAMEWORK) &&
      (entry.cwd === repoRoot || entry.cwd.startsWith(`${repoRoot}/`)),
  );
}

/** Any other framework command: the operator runs enrich, verify and apply side by side. */
const FRAMEWORK = 'sdd-framework';

/** Us and everything that started us: killing our own line would end the run reporting the sweep. */
function ancestry(byPid: Map<number, ProcessEntry>, self: number): Set<number> {
  const line = new Set<number>();

  for (let pid = self; pid > 1 && !line.has(pid);) {
    line.add(pid);
    pid = byPid.get(pid)?.ppid ?? 0;
  }
  return line;
}

/** Linux only: every process this user can see, with the two fields the sweep needs. */
export async function processTable(): Promise<ProcessEntry[]> {
  const names = await readdir('/proc').catch(() => [] as string[]);
  const entries: ProcessEntry[] = [];

  for (const name of names) {
    const pid = Number(name);
    if (!Number.isInteger(pid) || pid <= 0) continue;

    const cwd = await readlink(`/proc/${pid}/cwd`).catch(() => null);
    const stat = await readFile(`/proc/${pid}/stat`, 'utf8').catch(() => null);
    if (cwd === null || stat === null) continue;

    // The command may contain spaces and parentheses, so the fields after it are read from the
    // last ')' rather than by splitting the whole line.
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const ppid = Number(fields[1]);
    const pgid = Number(fields[2]);
    if (!Number.isInteger(pgid) || !Number.isInteger(ppid)) continue;

    const command = await readFile(`/proc/${pid}/cmdline`, 'utf8').catch(() => '');
    entries.push({ pid, ppid, pgid, cwd, command: command.replace(/\0/g, ' ').trim() });
  }
  return entries;
}

export async function sweepStrays(before: Set<number>, repoRoot: string): Promise<number> {
  const ownPgid = process.pid;
  const table = await processTable();
  const groups = strays(table, before, repoRoot, ownPgid);

  for (const pgid of groups) {
    try {
      process.kill(-pgid, 'SIGKILL');
    } catch {
      // Already gone, which is the common case.
    }
  }
  return groups.length;
}

export async function processIds(): Promise<Set<number>> {
  return new Set((await processTable()).map((entry) => entry.pid));
}

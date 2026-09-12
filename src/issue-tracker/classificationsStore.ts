import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Classification } from './classificationTypes.js';

/** One JSON line per known issue, keyed by issueId — read whole, rewritten whole on every upsert. */
export class ClassificationsStore {
  constructor(private readonly filePath: string) {}

  async readAll(): Promise<Map<number, Classification>> {
    const byIssueId = new Map<number, Classification>();
    let raw: string;
    try {
      raw = await readFile(this.filePath, 'utf8');
    } catch {
      return byIssueId;
    }

    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      const entry = JSON.parse(line) as Classification;
      byIssueId.set(entry.issueId, entry);
    }
    return byIssueId;
  }

  async get(issueId: number): Promise<Classification | undefined> {
    return (await this.readAll()).get(issueId);
  }

  async upsert(entry: Classification): Promise<void> {
    const all = await this.readAll();
    all.set(entry.issueId, entry);
    await mkdir(dirname(this.filePath), { recursive: true });
    const lines = [...all.values()].map((item) => JSON.stringify(item));
    await writeFile(this.filePath, lines.length > 0 ? lines.join('\n') + '\n' : '');
  }
}

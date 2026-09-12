import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ClassificationsStore } from '../../src/issue-tracker/classificationsStore.js';
import type { Classification } from '../../src/issue-tracker/classificationTypes.js';

function entry(issueId: number, overrides: Partial<Classification> = {}): Classification {
  return {
    issueId,
    reply: `reply for ${issueId}`,
    priority: 2,
    effortEst: 1,
    meta: {
      timeInMs: 10,
      etConsumed: 5,
      llmConfig: { model: 'm', effort: 'low', thinking: false },
    },
    ...overrides,
  };
}

describe('ClassificationsStore', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'classifications-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('returns an empty map when the file does not exist yet', async () => {
    const store = new ClassificationsStore(join(dir, 'sub', 'classifications.jsonl'));
    expect(await store.readAll()).toEqual(new Map());
  });

  it('creates the file (and its parent directory) on the first upsert', async () => {
    const store = new ClassificationsStore(join(dir, 'sub', 'classifications.jsonl'));
    await store.upsert(entry(1));
    expect(await store.get(1)).toEqual(entry(1));
  });

  it('upserts in place, keeping every other entry untouched', async () => {
    const store = new ClassificationsStore(join(dir, 'classifications.jsonl'));
    await store.upsert(entry(1));
    await store.upsert(entry(2));
    await store.upsert(entry(1, { priority: 4 }));

    const all = await store.readAll();
    expect(all.size).toBe(2);
    expect(all.get(1)?.priority).toBe(4);
    expect(all.get(2)?.priority).toBe(2);
  });

  it('rewrites byte-for-byte the same content when nothing changes between reads', async () => {
    const store = new ClassificationsStore(join(dir, 'classifications.jsonl'));
    await store.upsert(entry(1));
    const before = await store.get(1);
    const after = await store.get(1);
    expect(after).toEqual(before);
  });
});

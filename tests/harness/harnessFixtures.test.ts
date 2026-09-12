import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  findHarnessFixture,
  isInjectionFixture,
  loadHarnessFixtures,
} from '../../src/harness/harnessFixtures.js';

const FIXTURES = [
  {
    id: 1,
    title: 'A',
    body: 'body a',
    author: 'x',
    expected: { priority: 1, effortEst: 1 },
    why: 'w',
    tags: [],
  },
  {
    id: 2,
    title: 'B',
    body: 'body b',
    author: 'x',
    expected: { priority: 0, effortEst: 0 },
    why: 'w',
    tags: ['injection'],
  },
];

describe('loadHarnessFixtures', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'harness-fixtures-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads the fixtures file as-is, without reshaping any field', async () => {
    const path = join(dir, 'fixtures.json');
    writeFileSync(path, JSON.stringify(FIXTURES));

    const loaded = await loadHarnessFixtures(path);
    expect(loaded).toEqual(FIXTURES);
  });
});

describe('findHarnessFixture', () => {
  it('finds the fixture with the matching id', () => {
    expect(findHarnessFixture(FIXTURES, 2)?.title).toBe('B');
  });

  it('returns undefined when no fixture matches', () => {
    expect(findHarnessFixture(FIXTURES, 999)).toBeUndefined();
  });
});

describe('isInjectionFixture', () => {
  it('recognises the injection fixture by its tag, not its wording', () => {
    expect(isInjectionFixture(FIXTURES[0])).toBe(false);
    expect(isInjectionFixture(FIXTURES[1])).toBe(true);
  });
});

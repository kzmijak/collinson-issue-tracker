import { readFile } from 'node:fs/promises';

export interface HarnessFixture {
  id: number;
  title: string;
  body: string;
  author: string;
  expected: { priority: number; effortEst: number };
  why: string;
  tags: string[];
}

export async function loadHarnessFixtures(path: string): Promise<HarnessFixture[]> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as HarnessFixture[];
}

export function findHarnessFixture(
  fixtures: HarnessFixture[],
  id: number,
): HarnessFixture | undefined {
  return fixtures.find((fixture) => fixture.id === id);
}

export function isInjectionFixture(fixture: HarnessFixture): boolean {
  return fixture.tags.includes('injection');
}

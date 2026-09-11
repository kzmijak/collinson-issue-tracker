import type { Issue } from './types.js';

/**
 * The reader keeps only the highest issue number it has printed so far — not a full seen-set —
 * per the spec's "last-seen highest issue id/number in memory only". That is sound as long as
 * the source only ever grows by appending higher numbers, which is true of both the mock and
 * real GitHub issue numbering.
 */
export interface SeenState {
  highestNumber: number | null;
}

export function initialSeenState(): SeenState {
  return { highestNumber: null };
}

/** Oldest first, so the first poll's printed order and every later append stay consistent. */
export function selectNewIssues(issues: Issue[], seen: SeenState): Issue[] {
  const threshold = seen.highestNumber;
  const fresh = issues.filter((issue) => threshold === null || issue.number > threshold);
  return [...fresh].sort((a, b) => a.number - b.number);
}

export function advanceSeenState(seen: SeenState, issues: Issue[]): SeenState {
  const highest = issues.reduce(
    (max, issue) => Math.max(max, issue.number),
    seen.highestNumber ?? -Infinity,
  );
  if (highest === (seen.highestNumber ?? -Infinity)) return seen;
  return { highestNumber: highest };
}

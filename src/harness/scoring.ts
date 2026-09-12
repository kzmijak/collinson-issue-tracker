export const WORST_PENALTY = 38;

/** 2^|expectedPriority-actualPriority| + 2^|expectedEffort-actualEffort| - 2, per the spec's formula. */
export function penaltyFor(
  expectedPriority: number,
  expectedEffort: number,
  actualPriority: number,
  actualEffort: number,
): number {
  const priorityGap = Math.abs(expectedPriority - actualPriority);
  const effortGap = Math.abs(expectedEffort - actualEffort);
  return 2 ** priorityGap + 2 ** effortGap - 2;
}

export function accuracyFromPenalty(penalty: number): number {
  return (WORST_PENALTY - penalty) / WORST_PENALTY;
}

/**
 * Priority and effort accuracy are reported "separately as well" per the spec, without a formula of
 * their own being given. Kept on the same linear-gap-over-max-range shape as the combined score so the
 * three numbers stay comparable.
 */
export function priorityAccuracy(expectedPriority: number, actualPriority: number): number {
  const MAX_PRIORITY_GAP = 5;
  return 1 - Math.min(1, Math.abs(expectedPriority - actualPriority) / MAX_PRIORITY_GAP);
}

export function effortAccuracy(expectedEffort: number, actualEffort: number): number {
  const MAX_EFFORT_GAP = 3;
  return 1 - Math.min(1, Math.abs(expectedEffort - actualEffort) / MAX_EFFORT_GAP);
}

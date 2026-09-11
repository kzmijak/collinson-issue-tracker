/**
 * Exponential backoff, expressed as two pure functions so the math is testable without real
 * timers. `consecutiveFailures` reflects the outcome of the poll that just finished: 0 right
 * after a success (or at startup), incremented by one for each error in a row.
 */

export function nextConsecutiveFailures(current: number, success: boolean): number {
  return success ? 0 : current + 1;
}

/** Gap before the next poll: doubles per consecutive failure, collapses back to baseline on success. */
export function nextPollDelayMs(baseMs: number, consecutiveFailures: number): number {
  return baseMs * 2 ** consecutiveFailures;
}

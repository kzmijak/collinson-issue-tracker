import { describe, expect, it } from 'vitest';
import { nextConsecutiveFailures, nextPollDelayMs } from '../../src/issue-tracker/backoff.js';

describe('nextConsecutiveFailures', () => {
  it('resets to zero on any success', () => {
    expect(nextConsecutiveFailures(4, true)).toBe(0);
  });

  it('increments by one per consecutive failure', () => {
    expect(nextConsecutiveFailures(0, false)).toBe(1);
    expect(nextConsecutiveFailures(1, false)).toBe(2);
    expect(nextConsecutiveFailures(2, false)).toBe(3);
  });
});

describe('nextPollDelayMs', () => {
  const baseMs = 1000;

  it('is the baseline right after a success (zero consecutive failures)', () => {
    expect(nextPollDelayMs(baseMs, 0)).toBe(1000);
  });

  it('doubles per consecutive failure', () => {
    expect(nextPollDelayMs(baseMs, 1)).toBe(2000);
    expect(nextPollDelayMs(baseMs, 2)).toBe(4000);
    expect(nextPollDelayMs(baseMs, 3)).toBe(8000);
  });

  it('collapses straight back to baseline the poll after a success, regardless of how long the streak was', () => {
    const afterALongFailureStreak = nextConsecutiveFailures(5, true);
    expect(nextPollDelayMs(baseMs, afterALongFailureStreak)).toBe(baseMs);
  });

  it('models a full outage-and-recovery sequence the way check_backoff.py verifies it', () => {
    let failures = 0;
    const gaps: number[] = [];

    // success, fail, fail, success, success — mirrors accs.bash's #2-#3 outage
    for (const success of [true, false, false, true, true]) {
      failures = nextConsecutiveFailures(failures, success);
      gaps.push(nextPollDelayMs(baseMs, failures));
    }

    const [afterSuccess, afterFirstFail, afterSecondFail, afterRecovery, afterReset] = gaps;
    expect(afterFirstFail).toBeGreaterThan(afterSuccess * 1.3);
    expect(afterSecondFail).toBeGreaterThan(afterFirstFail * 1.3);
    expect(afterRecovery).toBe(baseMs);
    expect(afterReset).toBe(baseMs);
  });
});

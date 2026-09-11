import { describe, expect, it } from 'vitest';
import {
  advanceSeenState,
  initialSeenState,
  selectNewIssues,
} from '../../src/issue-tracker/issueSelection.js';
import type { Issue } from '../../src/issue-tracker/types.js';

function issue(number: number, title = `Issue ${number}`): Issue {
  return { id: number, number, title, state: 'open' };
}

describe('selectNewIssues', () => {
  it('on a blank seen state, treats every issue as new — the first poll', () => {
    const seen = initialSeenState();
    const issues = [issue(3), issue(1), issue(2)];

    expect(selectNewIssues(issues, seen)).toEqual([issue(1), issue(2), issue(3)]);
  });

  it('prints oldest first, regardless of the order issues arrive in', () => {
    const seen = initialSeenState();
    const issues = [issue(20), issue(5), issue(11)];

    expect(selectNewIssues(issues, seen).map((i) => i.number)).toEqual([5, 11, 20]);
  });

  it('only returns issues numbered above the highest one already seen', () => {
    const seen = { highestNumber: 15 };
    const issues = [issue(14), issue(15), issue(16), issue(17)];

    expect(selectNewIssues(issues, seen).map((i) => i.number)).toEqual([16, 17]);
  });

  it('returns nothing once every issue has already been seen', () => {
    const seen = { highestNumber: 20 };
    const issues = [issue(18), issue(19), issue(20)];

    expect(selectNewIssues(issues, seen)).toEqual([]);
  });
});

describe('advanceSeenState', () => {
  it('adopts the highest issue number from a blank start', () => {
    const seen = initialSeenState();
    const next = advanceSeenState(seen, [issue(3), issue(7), issue(2)]);

    expect(next.highestNumber).toBe(7);
  });

  it('only ever moves the threshold forward, never backward', () => {
    const seen = { highestNumber: 15 };
    const next = advanceSeenState(seen, [issue(16)]);

    expect(next.highestNumber).toBe(16);
  });

  it('leaves the threshold untouched when nothing newer is seen', () => {
    const seen = { highestNumber: 15 };
    const next = advanceSeenState(seen, [issue(10), issue(15)]);

    expect(next.highestNumber).toBe(15);
  });

  it('is stable across a poll with no issues at all', () => {
    const seen = { highestNumber: 15 };
    const next = advanceSeenState(seen, []);

    expect(next).toEqual(seen);
  });
});

describe('selectNewIssues + advanceSeenState together, across a run of polls', () => {
  it('never re-prints an issue once it has been reported once', () => {
    let seen = initialSeenState();

    const firstPoll = [issue(1), issue(2), issue(3)];
    const firstNew = selectNewIssues(firstPoll, seen);
    seen = advanceSeenState(seen, firstPoll);
    expect(firstNew.map((i) => i.number)).toEqual([1, 2, 3]);

    const secondPoll = [issue(1), issue(2), issue(3), issue(4)];
    const secondNew = selectNewIssues(secondPoll, seen);
    seen = advanceSeenState(seen, secondPoll);
    expect(secondNew.map((i) => i.number)).toEqual([4]);

    const thirdPoll = [issue(1), issue(2), issue(3), issue(4)];
    const thirdNew = selectNewIssues(thirdPoll, seen);
    expect(thirdNew).toEqual([]);
  });
});

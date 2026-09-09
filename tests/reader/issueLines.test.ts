import { describe, expect, it } from 'vitest';
import type { GitHubIssue } from '../../src/github/GitHub.js';
import { formatIssueLine, selectNewOpenIssues } from '../../src/reader/issueLines.js';

function issue(overrides: Partial<GitHubIssue>): GitHubIssue {
  return {
    id: 1,
    number: 1,
    title: 'Fix login bug',
    state: 'open',
    body: null,
    user: null,
    labels: [],
    html_url: 'https://github.com/kzmijak/collinson-issue-tracker/issues/1',
    created_at: '2026-09-01T09:14:22Z',
    updated_at: '2026-09-01T09:14:22Z',
    closed_at: null,
    ...overrides,
  };
}

describe('selectNewOpenIssues', () => {
  it('keeps open issues and drops closed ones', () => {
    const selected = selectNewOpenIssues(
      [
        issue({ id: 10, number: 1, title: 'Fix login bug' }),
        issue({ id: 20, number: 2, title: 'Update README', state: 'closed' }),
        issue({ id: 30, number: 3, title: 'Add dark mode' }),
      ],
      0,
    );

    expect(selected.map((selectedIssue) => selectedIssue.number)).toEqual([1, 3]);
  });

  it('drops issues already printed, identified by the last seen id', () => {
    const selected = selectNewOpenIssues(
      [issue({ id: 10, number: 1 }), issue({ id: 30, number: 3 })],
      10,
    );

    expect(selected.map((selectedIssue) => selectedIssue.id)).toEqual([30]);
  });

  it('returns nothing once every open issue has been seen', () => {
    expect(selectNewOpenIssues([issue({ id: 10 }), issue({ id: 30 })], 30)).toEqual([]);
  });

  it('orders by ascending id so the last seen id only ever moves forward', () => {
    const selected = selectNewOpenIssues(
      [issue({ id: 30, number: 3 }), issue({ id: 10, number: 1 })],
      0,
    );

    expect(selected.map((selectedIssue) => selectedIssue.id)).toEqual([10, 30]);
  });

  it('ignores a closed issue with a higher id than any open one', () => {
    const selected = selectNewOpenIssues(
      [issue({ id: 10, number: 1 }), issue({ id: 99, number: 9, state: 'closed' })],
      0,
    );

    expect(selected.map((selectedIssue) => selectedIssue.id)).toEqual([10]);
  });
});

describe('formatIssueLine', () => {
  it('renders as #<number> <title>', () => {
    expect(formatIssueLine(issue({ number: 3, title: 'Add dark mode' }))).toBe('#3 Add dark mode');
  });

  it('adds no prefix, timestamp or trailing whitespace', () => {
    expect(formatIssueLine(issue({ number: 1, title: 'Fix login bug' }))).toBe('#1 Fix login bug');
  });
});

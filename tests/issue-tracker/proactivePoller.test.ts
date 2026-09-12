import { describe, expect, it, vi } from 'vitest';
import { MARKER_COMMENT, ProactiveTracker } from '../../src/issue-tracker/proactivePoller.js';
import type { MockIssueSummary } from '../../src/issue-tracker/mockGithubClient.js';

function issue(number: number, commentsCount = 0): MockIssueSummary {
  return { number, title: `Issue ${number}`, comments_count: commentsCount };
}

describe('ProactiveTracker', () => {
  it('posts the marker comment on every issue it has not touched yet', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1), issue(2)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(2);
    expect(postComment).toHaveBeenCalledWith('http://localhost:4001', 1, MARKER_COMMENT);
    expect(postComment).toHaveBeenCalledWith('http://localhost:4001', 2, MARKER_COMMENT);
  });

  it('never comments twice on the same issue across repeated polls', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();
    await tracker.poll();
    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it('still comments once even if the issue already carries a human comment', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1, 3)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it('retries an issue on the next poll if its comment attempt failed', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1)]);
    const postComment = vi
      .fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce(undefined);
    const onError = vi.fn();
    const tracker = new ProactiveTracker('http://localhost:4001', {
      fetchIssues,
      postComment,
      onError,
    });

    await tracker.poll();
    expect(tracker.hasTouched(1)).toBe(false);
    expect(onError).toHaveBeenCalledWith(1, expect.any(Error));

    await tracker.poll();
    expect(postComment).toHaveBeenCalledTimes(2);
    expect(tracker.hasTouched(1)).toBe(true);
  });

  it('does not re-touch an issue that only appears in a later poll', async () => {
    const fetchIssues = vi
      .fn()
      .mockResolvedValueOnce([issue(1)])
      .mockResolvedValueOnce([issue(1), issue(2)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();
    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(2);
    expect(postComment).toHaveBeenNthCalledWith(2, 'http://localhost:4001', 2, MARKER_COMMENT);
  });
});

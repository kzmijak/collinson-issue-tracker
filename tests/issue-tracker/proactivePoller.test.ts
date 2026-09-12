import { describe, expect, it, vi } from 'vitest';
import {
  MARKER_AUTHOR,
  MARKER_COMMENT,
  ProactiveTracker,
} from '../../src/issue-tracker/proactivePoller.js';
import type { MockComment, MockIssueSummary } from '../../src/issue-tracker/mockGithubClient.js';

function issue(number: number, comments: MockComment[] = []): MockIssueSummary {
  return { number, title: `Issue ${number}`, comments };
}

function humanComment(body: string): MockComment {
  return { author: 'JohnDoe', body, createdAt: new Date().toISOString() };
}

function markerComment(): MockComment {
  return { author: MARKER_AUTHOR, body: MARKER_COMMENT, createdAt: new Date().toISOString() };
}

describe('ProactiveTracker', () => {
  it('posts the marker comment on every issue it has not touched yet', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1), issue(2)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(2);
    expect(postComment).toHaveBeenCalledWith(
      'http://localhost:4001',
      1,
      MARKER_COMMENT,
      MARKER_AUTHOR,
    );
    expect(postComment).toHaveBeenCalledWith(
      'http://localhost:4001',
      2,
      MARKER_COMMENT,
      MARKER_AUTHOR,
    );
  });

  it('never comments twice on the same issue across repeated polls', async () => {
    const fetchIssues = vi
      .fn()
      .mockResolvedValueOnce([issue(1)])
      .mockResolvedValue([issue(1, [markerComment()])]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();
    await tracker.poll();
    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it('still comments once even if the issue already carries a human comment', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1, [humanComment('nice work')])]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(1);
  });

  it('does not comment again once its own marker is present', async () => {
    const fetchIssues = vi
      .fn()
      .mockResolvedValue([issue(1, [humanComment('nice work'), markerComment()])]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();

    expect(postComment).not.toHaveBeenCalled();
  });

  it('reports an error via onError and leaves the issue eligible for retry', async () => {
    const fetchIssues = vi.fn().mockResolvedValue([issue(1)]);
    const postComment = vi.fn().mockRejectedValue(new Error('boom'));
    const onError = vi.fn();
    const tracker = new ProactiveTracker('http://localhost:4001', {
      fetchIssues,
      postComment,
      onError,
    });

    await tracker.poll();

    expect(onError).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('does not touch an issue that only appears in a later poll until it does', async () => {
    const fetchIssues = vi
      .fn()
      .mockResolvedValueOnce([issue(1, [markerComment()])])
      .mockResolvedValueOnce([issue(1, [markerComment()]), issue(2)]);
    const postComment = vi.fn().mockResolvedValue(undefined);
    const tracker = new ProactiveTracker('http://localhost:4001', { fetchIssues, postComment });

    await tracker.poll();
    await tracker.poll();

    expect(postComment).toHaveBeenCalledTimes(1);
    expect(postComment).toHaveBeenCalledWith(
      'http://localhost:4001',
      2,
      MARKER_COMMENT,
      MARKER_AUTHOR,
    );
  });
});

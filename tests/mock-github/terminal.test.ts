import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CommentsStore } from '../../src/mock-github/commentsStore.js';
import { GrowingIssueDataset } from '../../src/mock-github/dataset.js';
import { logNewComment, repaint } from '../../src/mock-github/terminal.js';

describe('repaint', () => {
  let writes: string[];

  beforeEach(() => {
    writes = [];
    vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      writes.push(String(chunk));
      return true;
    });
  });

  afterEach(() => {
    delete process.env.MOCK_GITHUB_BUFFER_CAP;
    delete (process.stdout as { isTTY?: boolean }).isTTY;
  });

  function output(): string {
    return writes.join('');
  }

  it('prefixes every repaint with the ANSI clear code when attached to a real TTY', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = true;
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);
    repaint(dataset, comments);

    const lines = output().split('\n');
    const snapshotLines = lines.filter((line) => /^===SNAPSHOT \d+ .+===$/.test(line));
    expect(snapshotLines.length).toBe(2);

    const firstClearIndex = output().indexOf('\x1B[2J\x1B[H');
    expect(firstClearIndex).toBeGreaterThanOrEqual(0);
  });

  it('skips the ANSI clear code when not attached to a TTY, so a piped/captured log stays clean', () => {
    (process.stdout as { isTTY?: boolean }).isTTY = false;
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);
    repaint(dataset, comments);

    expect(output().includes('\x1B[2J\x1B[H')).toBe(false);
    const lines = output().split('\n');
    const snapshotLines = lines.filter((line) => /^===SNAPSHOT \d+ .+===$/.test(line));
    expect(snapshotLines.length).toBe(2);
  });

  it('numbers snapshots strictly increasing, never repeating', () => {
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);
    repaint(dataset, comments);
    repaint(dataset, comments);

    const numbers = output()
      .split('\n')
      .map((line) => /^===SNAPSHOT (\d+) /.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => Number(match[1]));

    expect(numbers.length).toBe(3);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('prints every visible issue exactly once per snapshot with its comment count', () => {
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();
    comments.addComment(1, 'hi', 'Alice');

    repaint(dataset, comments);

    const lines = output().split('\n');
    const issueOneLines = lines.filter((line) => line.startsWith('Issues #1:'));
    expect(issueOneLines).toEqual(['Issues #1: (1)']);
  });

  it('truncates to the buffer cap and ends the screen with "..."', () => {
    process.env.MOCK_GITHUB_BUFFER_CAP = '5';
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);

    const lines = output().split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(lines[lines.length - 1]).toBe('...');
  });

  it('never exceeds the cap and never repeats an issue when capped generously', () => {
    process.env.MOCK_GITHUB_BUFFER_CAP = '500';
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);

    const lines = output().split('\n').filter((line) => line.trim() !== '');
    expect(lines.length).toBeLessThanOrEqual(500);
    const issueIds = lines
      .map((line) => /^Issues #(\d+):/.exec(line))
      .filter((match): match is RegExpExecArray => match !== null)
      .map((match) => match[1]);
    expect(new Set(issueIds).size).toBe(issueIds.length);
  });
});

describe('logNewComment', () => {
  it('writes the mutation log line with issue id and author', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    logNewComment(3, 'curl-user');

    expect(write).toHaveBeenCalledWith('[comment] issue #3 +1 from curl-user\n');
  });
});

import { beforeEach, describe, expect, it, vi } from 'vitest';
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
    vi.spyOn(console, 'warn').mockImplementation((line: unknown) => {
      writes.push(`${String(line)}\n`);
    });
  });

  function output(): string {
    return writes.join('');
  }

  it('prefixes every repaint with the ANSI clear code followed by its own Snapshot line', () => {
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);
    repaint(dataset, comments);

    const lines = output().split('\n');
    const snapshotLines = lines.filter((line) => line.startsWith('Snapshot #'));
    expect(snapshotLines.length).toBe(2);

    const firstClearIndex = output().indexOf('\x1B[2J\x1B[H');
    expect(firstClearIndex).toBeGreaterThanOrEqual(0);
  });

  it('numbers snapshots strictly increasing across calls, never repeating', () => {
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();

    repaint(dataset, comments);
    repaint(dataset, comments);
    repaint(dataset, comments);

    const numbers = output()
      .split('\n')
      .filter((line) => line.startsWith('Snapshot #'))
      .map((line) => Number(line.replace('Snapshot #', '')));

    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it('prints every visible issue exactly once per snapshot with its comment count', () => {
    const dataset = new GrowingIssueDataset();
    const comments = new CommentsStore();
    comments.addComment(1, 'hi', 'Alice');

    repaint(dataset, comments);

    const lines = output().split('\n');
    const issueOneLines = lines.filter((line) => line.startsWith('Issue #1:'));
    expect(issueOneLines).toEqual(['Issue #1: (1)']);
  });
});

describe('logNewComment', () => {
  it('writes the mutation log line with issue number and author', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    logNewComment(3, 'curl-user');

    expect(warn).toHaveBeenCalledWith('New comment on issue #3 by curl-user');
  });
});

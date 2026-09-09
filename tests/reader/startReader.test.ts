import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeGitHub } from '../../src/github/FakeGitHub.js';
import type { GitHub, GitHubIssue } from '../../src/github/GitHub.js';
import { backoffDelayMs, type Reader, startReader } from '../../src/reader/startReader.js';
import { FakeStatusBarWriter, StatusBar } from '../../src/reader/statusBar.js';

const POLL_INTERVAL_MS = 1000;
const STATUS_TICK_MS = 1000;

interface Harness {
  start: () => Reader;
  writer: FakeStatusBarWriter;
}

function harness(github: GitHub): Harness {
  const writer = new FakeStatusBarWriter();
  return {
    writer,
    start: () =>
      startReader({
        github,
        statusBar: new StatusBar(writer),
        pollIntervalMs: POLL_INTERVAL_MS,
        statusTickMs: STATUS_TICK_MS,
      }),
  };
}

function scriptedGitHub(outcomes: readonly ('ok' | 'fail')[]): GitHub & { calls: number[] } {
  const calls: number[] = [];
  return {
    calls,
    listIssues: async (): Promise<readonly GitHubIssue[]> => {
      const outcome = outcomes[calls.length] ?? 'ok';
      calls.push(Date.now());
      if (outcome === 'fail') throw new Error('scripted failure');
      return new FakeGitHub().listIssues();
    },
  };
}

function occurrences(stream: string, needle: string): number {
  return stream.split(needle).length - 1;
}

describe('backoffDelayMs', () => {
  it('waits one interval while nothing has failed', () => {
    expect(backoffDelayMs(1000, 0)).toBe(1000);
  });

  it('doubles for each consecutive failure', () => {
    expect(backoffDelayMs(1000, 1)).toBe(2000);
    expect(backoffDelayMs(1000, 2)).toBe(4000);
    expect(backoffDelayMs(1000, 3)).toBe(8000);
  });
});

describe('startReader', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the status bar before the first poll has produced anything', () => {
    const { start, writer } = harness(new FakeGitHub());
    const reader = start();

    expect(writer.stream).toBe('\nPolling .');
    reader.stop();
  });

  it('appends each open issue once and never the closed one', async () => {
    const { start, writer } = harness(new FakeGitHub());
    const reader = start();

    await vi.advanceTimersByTimeAsync(5000);
    reader.stop();

    expect(occurrences(writer.stream, '#1 Fix login bug')).toBe(1);
    expect(occurrences(writer.stream, '#3 Add dark mode')).toBe(1);
    expect(writer.stream).not.toContain('Update README');
  });

  it('keeps each issue on a line of its own and the bar on the last line', async () => {
    const { start, writer } = harness(new FakeGitHub());
    const reader = start();

    await vi.advanceTimersByTimeAsync(5000);
    reader.stop();

    expect(writer.lines.filter((line) => line.includes('#1 Fix login bug'))).toHaveLength(1);
    expect(writer.lines.filter((line) => line.includes('#3 Add dark mode'))).toHaveLength(1);
    expect(writer.lines.at(-1)).toContain('Polling');
  });

  it('doubles the poll delay after each consecutive failure and resets after a success', async () => {
    const github = scriptedGitHub(['fail', 'fail', 'ok', 'fail', 'ok']);
    const { start } = harness(github);
    const reader = start();

    await vi.advanceTimersByTimeAsync(20_000);
    reader.stop();

    expect(github.calls.slice(0, 5)).toEqual([0, 2000, 6000, 7000, 9000]);
  });

  it('marks a failure inline on the bar and clears it once a poll succeeds', async () => {
    const { start, writer } = harness(new FakeGitHub(2));
    const reader = start();

    await vi.advanceTimersByTimeAsync(0);
    expect(writer.stream).toContain('Error: simulated mock GitHub API failure');

    await vi.advanceTimersByTimeAsync(6000);
    reader.stop();

    expect(writer.stream).toContain('#1 Fix login bug');
    expect(writer.stream.indexOf('Error')).toBeLessThan(writer.stream.indexOf('#1 Fix login bug'));
    expect(writer.lines.at(-1)).not.toContain('Error');
  });

  it('keeps running after failures instead of exiting', async () => {
    const { start, writer } = harness(new FakeGitHub(2));
    const reader = start();

    await vi.advanceTimersByTimeAsync(6000);
    reader.stop();

    expect(writer.stream).toContain('#1 Fix login bug');
  });

  it('stops polling and ticking once stopped', async () => {
    const github = scriptedGitHub([]);
    const { start, writer } = harness(github);
    const reader = start();

    await vi.advanceTimersByTimeAsync(1000);
    reader.stop();
    const settled = writer.chunks.length;
    await vi.advanceTimersByTimeAsync(10_000);

    expect(writer.chunks).toHaveLength(settled);
    expect(github.calls).toHaveLength(2);
  });
});

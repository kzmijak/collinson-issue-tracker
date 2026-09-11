import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ALL_ISSUES,
  GROWTH_INTERVAL_MS,
  GrowingIssueDataset,
  INITIAL_VISIBLE_COUNT,
  MAX_VISIBLE_COUNT,
  growVisibleCount,
} from '../../src/mock-github/dataset.js';

describe('growVisibleCount', () => {
  it('grows by one step', () => {
    expect(growVisibleCount(15)).toBe(16);
  });

  it('never exceeds the dataset size, even if called past it', () => {
    expect(growVisibleCount(MAX_VISIBLE_COUNT)).toBe(MAX_VISIBLE_COUNT);
    expect(growVisibleCount(MAX_VISIBLE_COUNT + 5)).toBe(MAX_VISIBLE_COUNT);
  });
});

describe('GrowingIssueDataset', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('serves 15 issues immediately on boot — before any timer has ever ticked', () => {
    const dataset = new GrowingIssueDataset();
    expect(dataset.getVisibleIssues()).toHaveLength(INITIAL_VISIBLE_COUNT);
  });

  it('never leaks a pull_request field, since that is what marks a real GitHub object as a PR', () => {
    const dataset = new GrowingIssueDataset();
    expect(dataset.getVisibleIssues().some((issue) => 'pull_request' in issue)).toBe(false);
  });

  it('does not grow until startGrowth() runs a real timer', () => {
    const dataset = new GrowingIssueDataset();
    vi.advanceTimersByTime(GROWTH_INTERVAL_MS * 3);
    expect(dataset.getVisibleCount()).toBe(INITIAL_VISIBLE_COUNT);
  });

  it('reveals one more issue every growth interval once started', () => {
    const dataset = new GrowingIssueDataset();
    dataset.startGrowth();

    vi.advanceTimersByTime(GROWTH_INTERVAL_MS);
    expect(dataset.getVisibleCount()).toBe(16);

    vi.advanceTimersByTime(GROWTH_INTERVAL_MS);
    expect(dataset.getVisibleCount()).toBe(17);
  });

  it('stops growing once it reaches the full 20-issue dataset', () => {
    const dataset = new GrowingIssueDataset();
    dataset.startGrowth();

    vi.advanceTimersByTime(GROWTH_INTERVAL_MS * 10);
    expect(dataset.getVisibleCount()).toBe(MAX_VISIBLE_COUNT);
    expect(dataset.getVisibleIssues()).toEqual(ALL_ISSUES);
  });

  it('starting growth twice does not double the rate', () => {
    const dataset = new GrowingIssueDataset();
    dataset.startGrowth();
    dataset.startGrowth();

    vi.advanceTimersByTime(GROWTH_INTERVAL_MS);
    expect(dataset.getVisibleCount()).toBe(16);
  });

  it('stop() freezes the count where it is', () => {
    const dataset = new GrowingIssueDataset();
    dataset.startGrowth();
    vi.advanceTimersByTime(GROWTH_INTERVAL_MS);
    dataset.stop();

    vi.advanceTimersByTime(GROWTH_INTERVAL_MS * 5);
    expect(dataset.getVisibleCount()).toBe(16);
  });
});

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchIssues = vi.fn();
const postComment = vi.fn();
const classifyIssue = vi.fn();

vi.mock('../../src/issue-tracker/mockGithubClient.js', () => ({
  fetchIssues: (...args: unknown[]) => fetchIssues(...args),
  postComment: (...args: unknown[]) => postComment(...args),
}));

vi.mock('../../src/issue-tracker/llmClassifier.js', () => ({
  classifyIssue: (...args: unknown[]) => classifyIssue(...args),
}));

const { runClassifier } = await import('../../src/issue-tracker/classifier.js');
const { ClassificationsStore } = await import('../../src/issue-tracker/classificationsStore.js');
const { markerFor, renderComment } =
  await import('../../src/issue-tracker/classificationComment.js');

const LLM_CONFIG = { model: 'm', effort: 'low', thinking: false };

describe('runClassifier', () => {
  let dir: string;
  let store: InstanceType<typeof ClassificationsStore>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'classifier-'));
    store = new ClassificationsStore(join(dir, 'classifications.jsonl'));
    fetchIssues.mockReset();
    postComment.mockReset().mockResolvedValue(undefined);
    classifyIssue.mockReset();
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('classifies a brand-new issue: calls the LLM, posts a comment, and upserts the jsonl', async () => {
    fetchIssues.mockResolvedValue([{ id: 1, title: 'Bug', content: 'It crashes', comments: [] }]);
    classifyIssue.mockResolvedValue({
      reply: 'A real bug.',
      priority: 4,
      effortEst: 2,
      timeInMs: 10,
      etConsumed: 20,
    });

    const lines: string[] = [];
    const ok = await runClassifier({
      baseUrl: 'http://x',
      specId: 'spec-1',
      llmConfig: LLM_CONFIG,
      store,
      onLine: (line) => lines.push(line),
    });

    expect(ok).toBe(true);
    expect(lines).toEqual(['CLASSIFIED issueId=1']);
    expect(classifyIssue).toHaveBeenCalledTimes(1);
    expect(postComment).toHaveBeenCalledTimes(1);
    const entry = await store.get(1);
    expect(entry).toMatchObject({ issueId: 1, priority: 4, effortEst: 2 });
  });

  it('skips an issue that already carries a marker comment, without calling the LLM', async () => {
    const marker = markerFor('spec-1', 2);
    fetchIssues.mockResolvedValue([
      {
        id: 2,
        title: 'Old',
        content: 'Already handled',
        comments: [
          { author: 'GitHub Issues Classifier', body: `${marker}\nold reply`, createdAt: 'now' },
        ],
      },
    ]);

    const lines: string[] = [];
    const ok = await runClassifier({
      baseUrl: 'http://x',
      specId: 'spec-1',
      llmConfig: LLM_CONFIG,
      store,
      onLine: (line) => lines.push(line),
    });

    expect(ok).toBe(true);
    expect(lines).toEqual(['SKIPPED issueId=2']);
    expect(classifyIssue).not.toHaveBeenCalled();
    expect(postComment).not.toHaveBeenCalled();
  });

  it('replays a cached classification when the marker comment is gone but the jsonl entry exists', async () => {
    await store.upsert({
      issueId: 3,
      reply: 'Cached reply',
      priority: 2,
      effortEst: 1,
      meta: { timeInMs: 1, etConsumed: 1, llmConfig: LLM_CONFIG },
    });
    fetchIssues.mockResolvedValue([{ id: 3, title: 'T', content: 'C', comments: [] }]);

    const lines: string[] = [];
    const ok = await runClassifier({
      baseUrl: 'http://x',
      specId: 'spec-1',
      llmConfig: LLM_CONFIG,
      store,
      onLine: (line) => lines.push(line),
    });

    expect(ok).toBe(true);
    expect(lines).toEqual(['REPOSTED issueId=3']);
    expect(classifyIssue).not.toHaveBeenCalled();
    expect(postComment).toHaveBeenCalledWith(
      'http://x',
      3,
      renderComment('spec-1', (await store.get(3))!),
      'GitHub Issues Classifier',
    );
  });

  it('forces effortEst to 0 whenever the LLM returns priority 0', async () => {
    fetchIssues.mockResolvedValue([{ id: 4, title: 'Spam', content: 'buy now', comments: [] }]);
    classifyIssue.mockResolvedValue({
      reply: 'Not a real report.',
      priority: 0,
      effortEst: 0,
      timeInMs: 5,
      etConsumed: 5,
    });

    await runClassifier({ baseUrl: 'http://x', specId: 'spec-1', llmConfig: LLM_CONFIG, store });

    expect((await store.get(4))?.effortEst).toBe(0);
  });

  it('reports a failure and keeps going when one issue errors out', async () => {
    fetchIssues.mockResolvedValue([
      { id: 5, title: 'Fails', content: 'x', comments: [] },
      { id: 6, title: 'Fine', content: 'y', comments: [] },
    ]);
    classifyIssue.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce({
      reply: 'ok',
      priority: 1,
      effortEst: 1,
      timeInMs: 1,
      etConsumed: 1,
    });

    const lines: string[] = [];
    const ok = await runClassifier({
      baseUrl: 'http://x',
      specId: 'spec-1',
      llmConfig: LLM_CONFIG,
      store,
      onLine: (line) => lines.push(line),
    });

    expect(ok).toBe(false);
    expect(lines[0]).toContain('FAILED issueId=5');
    expect(lines[1]).toBe('CLASSIFIED issueId=6');
  });
});

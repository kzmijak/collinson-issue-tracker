import { describe, expect, it, vi } from 'vitest';
import { classifySingleFixture } from '../../src/harness/singleFixtureClassify.js';
import type { HarnessFixture } from '../../src/harness/harnessFixtures.js';

const FIXTURE: HarnessFixture = {
  id: 7,
  title: 'Wrong error message',
  body: 'Set GITHUB_REPO wrong and get a misleading error.',
  author: 'x',
  expected: { priority: 2, effortEst: 1 },
  why: 'w',
  tags: [],
};

const CONFIG = { model: 'claude-haiku-4-5', effort: 'low', thinking: false };

describe('classifySingleFixture', () => {
  it('looks the issue up by id in the fixtures array and passes its title/body to the classifier, never GitHub', async () => {
    const classify = vi
      .fn()
      .mockResolvedValue({ reply: 'ok', priority: 2, effortEst: 1, timeInMs: 12, etConsumed: 34 });

    const result = await classifySingleFixture(7, [FIXTURE], classify, CONFIG);

    expect(classify).toHaveBeenCalledWith({ title: FIXTURE.title, content: FIXTURE.body }, CONFIG);
    expect(result).toEqual({ priority: 2, effort: 1, et: 34, timeMs: 12 });
  });

  it('throws when no fixture matches the given id', async () => {
    const classify = vi.fn();
    await expect(classifySingleFixture(999, [FIXTURE], classify, CONFIG)).rejects.toThrow(/999/);
    expect(classify).not.toHaveBeenCalled();
  });
});

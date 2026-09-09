import { describe, expect, it } from 'vitest';
import { FakeGitHub } from '../../src/github/FakeGitHub.js';

describe('FakeGitHub', () => {
  it('serves the three fixed issues of the static dataset', async () => {
    const issues = await new FakeGitHub().listIssues();

    expect(issues.map((issue) => [issue.number, issue.title, issue.state])).toEqual([
      [1, 'Fix login bug', 'open'],
      [2, 'Update README', 'closed'],
      [3, 'Add dark mode', 'open'],
    ]);
  });

  it('returns the same dataset on every call', async () => {
    const github = new FakeGitHub();

    expect(await github.listIssues()).toEqual(await github.listIssues());
  });

  it('fails the first N calls when told to simulate failures, then succeeds', async () => {
    const github = new FakeGitHub(2);

    await expect(github.listIssues()).rejects.toThrow(/simulated mock GitHub API failure/);
    await expect(github.listIssues()).rejects.toThrow(/simulated mock GitHub API failure/);
    expect(await github.listIssues()).toHaveLength(3);
  });

  it('never fails when no failures are simulated', async () => {
    await expect(new FakeGitHub(0).listIssues()).resolves.toHaveLength(3);
  });
});

import type { GitHub, GitHubIssue } from './GitHub.js';

const MOCK_ISSUES: readonly GitHubIssue[] = [
  {
    id: 2891740001,
    number: 1,
    title: 'Fix login bug',
    state: 'open',
    body: 'Signing in with a saved password returns a 500 on the second attempt.',
    user: { login: 'kzmijak', id: 4210001 },
    labels: [{ id: 7710001, name: 'bug' }],
    html_url: 'https://github.com/kzmijak/collinson-issue-tracker/issues/1',
    created_at: '2026-09-01T09:14:22Z',
    updated_at: '2026-09-02T11:02:47Z',
    closed_at: null,
  },
  {
    id: 2891740002,
    number: 2,
    title: 'Update README',
    state: 'closed',
    body: 'The install section still mentions npm.',
    user: { login: 'octocat', id: 4210002 },
    labels: [{ id: 7710002, name: 'documentation' }],
    html_url: 'https://github.com/kzmijak/collinson-issue-tracker/issues/2',
    created_at: '2026-09-01T14:40:03Z',
    updated_at: '2026-09-03T08:19:55Z',
    closed_at: '2026-09-03T08:19:55Z',
  },
  {
    id: 2891740003,
    number: 3,
    title: 'Add dark mode',
    state: 'open',
    body: null,
    user: null,
    labels: [
      { id: 7710003, name: 'enhancement' },
      { id: 7710004, name: 'help wanted' },
    ],
    html_url: 'https://github.com/kzmijak/collinson-issue-tracker/issues/3',
    created_at: '2026-09-04T17:05:11Z',
    updated_at: '2026-09-04T17:05:11Z',
    closed_at: null,
  },
];

export class FakeGitHub implements GitHub {
  private remainingFailures: number;

  constructor(failCount = 0) {
    this.remainingFailures = failCount;
  }

  async listIssues(): Promise<readonly GitHubIssue[]> {
    if (this.remainingFailures > 0) {
      this.remainingFailures -= 1;
      throw new Error(
        `simulated mock GitHub API failure, ${this.remainingFailures} remaining (GITHUB_MOCK_FAIL_COUNT)`,
      );
    }

    return MOCK_ISSUES;
  }
}

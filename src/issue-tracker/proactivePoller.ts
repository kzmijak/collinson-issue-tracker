import type { MockIssueSummary } from './mockGithubClient.js';

export const MARKER_AUTHOR = 'GitHub Issues Tracker';
export const MARKER_COMMENT = "I've been here!";

export interface ProactiveTrackerDeps {
  fetchIssues: (baseUrl: string) => Promise<MockIssueSummary[]>;
  postComment: (
    baseUrl: string,
    issueNumber: number,
    body: string,
    author: string,
  ) => Promise<void>;
  onError?: (issueNumber: number, error: unknown) => void;
}

function alreadyTouched(issue: MockIssueSummary): boolean {
  return issue.comments.some((comment) => comment.author === MARKER_AUTHOR);
}

/**
 * "Touched" is re-derived from each issue's own comment list on every poll rather than a private
 * log — the only durable signal available, since neither service persists state to disk.
 */
export class ProactiveTracker {
  constructor(
    private readonly baseUrl: string,
    private readonly deps: ProactiveTrackerDeps,
  ) {}

  async poll(): Promise<void> {
    const issues = await this.deps.fetchIssues(this.baseUrl);

    for (const issue of issues) {
      if (alreadyTouched(issue)) continue;

      try {
        await this.deps.postComment(this.baseUrl, issue.number, MARKER_COMMENT, MARKER_AUTHOR);
      } catch (error) {
        this.deps.onError?.(issue.number, error);
      }
    }
  }
}

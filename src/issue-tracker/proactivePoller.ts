import type { MockIssueSummary } from './mockGithubClient.js';

export const MARKER_COMMENT = "I've been here!";

export interface ProactiveTrackerDeps {
  fetchIssues: (baseUrl: string) => Promise<MockIssueSummary[]>;
  postComment: (baseUrl: string, issueNumber: number, body: string) => Promise<void>;
  onError?: (issueNumber: number, error: unknown) => void;
}

/**
 * Marks an issue "touched" before the comment POST resolves, not after — otherwise two poll
 * ticks racing during one slow request could each decide the issue is still untouched and both
 * post the marker.
 */
export class ProactiveTracker {
  private readonly touched = new Set<number>();

  constructor(
    private readonly baseUrl: string,
    private readonly deps: ProactiveTrackerDeps,
  ) {}

  async poll(): Promise<void> {
    const issues = await this.deps.fetchIssues(this.baseUrl);

    for (const issue of issues) {
      if (this.touched.has(issue.number)) continue;
      this.touched.add(issue.number);

      try {
        await this.deps.postComment(this.baseUrl, issue.number, MARKER_COMMENT);
      } catch (error) {
        this.touched.delete(issue.number);
        this.deps.onError?.(issue.number, error);
      }
    }
  }

  hasTouched(issueNumber: number): boolean {
    return this.touched.has(issueNumber);
  }
}

import type { GitHubIssue } from '../github/GitHub.js';

/**
 * The process is stateless and remembers only the highest issue id it has already printed, so a
 * poll re-reading the whole list emits nothing it has emitted before.
 */
export function selectNewOpenIssues(
  issues: readonly GitHubIssue[],
  lastSeenIssueId: number,
): GitHubIssue[] {
  return issues
    .filter((issue) => issue.state === 'open' && issue.id > lastSeenIssueId)
    .sort((left, right) => left.id - right.id);
}

export function formatIssueLine(issue: GitHubIssue): string {
  return `#${issue.number} ${issue.title}`;
}

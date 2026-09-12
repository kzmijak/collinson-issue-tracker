import type { CommentsStore } from './commentsStore.js';
import type { GrowingIssueDataset } from './dataset.js';

const REPAINT_INTERVAL_MS = 1000;

/**
 * A separator line between repaints — without it, consecutive "Issue #n: k comment(s)" lines
 * from back-to-back repaints would be indistinguishable from one long list.
 */
function repaint(dataset: GrowingIssueDataset, comments: CommentsStore): void {
  process.stdout.write('\x1B[2J\x1B[0f');
  console.warn(`GitHub Service Terminal — ${new Date().toISOString()}`);
  for (const issue of dataset.getVisibleIssues()) {
    console.warn(`Issue #${issue.number}: ${comments.getCommentsCount(issue.number)} comment(s)`);
  }
}

/** Starts the always-on repaint loop; the timer is unref'd so it never keeps the process alive. */
export function startGithubServiceTerminal(
  dataset: GrowingIssueDataset,
  comments: CommentsStore,
): NodeJS.Timeout {
  repaint(dataset, comments);
  const timer = setInterval(() => repaint(dataset, comments), REPAINT_INTERVAL_MS);
  timer.unref();
  return timer;
}

export function logNewComment(issueNumber: number): void {
  console.warn(`New comment on issue #${issueNumber}`);
}

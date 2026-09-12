import type { CommentsStore } from './commentsStore.js';
import type { GrowingIssueDataset } from './dataset.js';

let snapshotCounter = 0;

/**
 * Full clear + reprint of the entire current issue list, top to bottom, prefixed by a strictly
 * increasing `Snapshot #<n>` header so ACCS can split captured stdout into distinct repaints.
 */
export function repaint(dataset: GrowingIssueDataset, comments: CommentsStore): void {
  snapshotCounter += 1;
  process.stdout.write('\x1B[2J\x1B[H\n');
  console.warn(`Snapshot #${snapshotCounter}`);
  for (const issue of dataset.getVisibleIssues()) {
    const issueComments = comments.getComments(issue.number);
    console.warn(`Issue #${issue.number}: (${issueComments.length})`);
    console.warn(`Title: ${issue.title}`);
    console.warn(`Content: ${issue.body}`);
    console.warn('Comments:');
    for (const comment of issueComments) {
      console.warn(`  - [${comment.author}]`);
      console.warn(`    ${comment.body}`);
      console.warn('');
    }
    console.warn('');
  }
}

export function logNewComment(issueNumber: number, author: string): void {
  console.warn(`New comment on issue #${issueNumber} by ${author}`);
}

import type { CommentsStore } from './commentsStore.js';
import type { GrowingIssueDataset } from './dataset.js';

/** Full clear (no scrollback append) + reprint of the entire current issue list, top to bottom. */
export function repaint(dataset: GrowingIssueDataset, comments: CommentsStore): void {
  process.stdout.write('\x1B[2J\x1B[0f');
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

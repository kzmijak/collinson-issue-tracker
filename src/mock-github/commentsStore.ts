export interface MockComment {
  body: string;
  created_at: string;
}

/** In-memory only — mutations are lost the moment the process exits, by design for this spec. */
export class CommentsStore {
  private readonly commentsByIssue = new Map<number, MockComment[]>();

  addComment(issueNumber: number, body: string): MockComment {
    const comment: MockComment = { body, created_at: new Date().toISOString() };
    const existing = this.commentsByIssue.get(issueNumber);
    if (existing) {
      existing.push(comment);
    } else {
      this.commentsByIssue.set(issueNumber, [comment]);
    }
    return comment;
  }

  getComments(issueNumber: number): MockComment[] {
    return this.commentsByIssue.get(issueNumber) ?? [];
  }

  getCommentsCount(issueNumber: number): number {
    return this.getComments(issueNumber).length;
  }
}

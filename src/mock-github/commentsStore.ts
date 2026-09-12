export interface MockComment {
  author: string;
  body: string;
  createdAt: string;
}

/** In-memory only — mutations are lost the moment the process exits, by design for this spec. */
export class CommentsStore {
  private readonly commentsByIssue = new Map<number, MockComment[]>();

  addComment(issueNumber: number, body: string, author = 'Anonymous'): MockComment {
    const comment: MockComment = { author, body, createdAt: new Date().toISOString() };
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

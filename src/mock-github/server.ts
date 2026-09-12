import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { CommentsStore } from './commentsStore.js';
import type { GrowingIssueDataset } from './dataset.js';

const REPO_ISSUES_PATH = /^\/repos\/[^/]+\/[^/]+\/issues\/?$/;
const ISSUES_PATH = /^\/issues\/?$/;
const ISSUE_COMMENTS_PATH = /^\/issues\/(\d+)\/comments\/?$/;

function readJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * Mirrors just enough of the real GitHub REST shape for the reader to be unable to tell the
 * difference: GET / for a liveness probe, GET /repos/:owner/:repo/issues for the issues list (used
 * by the read-only spec), plus the flat GET/POST /issues* routes this spec's mutation endpoint
 * needs. `onCommentAdded` fires synchronously once a comment is accepted, for the terminal's log line.
 */
export function createMockGithubServer(
  dataset: GrowingIssueDataset,
  comments: CommentsStore,
  onCommentAdded: (issueNumber: number) => void,
): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('mock-github ok');
      return;
    }

    if (req.method === 'GET' && REPO_ISSUES_PATH.test(url.pathname)) {
      const state = url.searchParams.get('state');
      const issues = dataset.getVisibleIssues().filter((issue) => !state || issue.state === state);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(issues));
      return;
    }

    if (req.method === 'GET' && ISSUES_PATH.test(url.pathname)) {
      const issues = dataset.getVisibleIssues().map((issue) => ({
        ...issue,
        comments_count: comments.getCommentsCount(issue.number),
      }));
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(issues));
      return;
    }

    const commentsMatch = ISSUE_COMMENTS_PATH.exec(url.pathname);
    if (commentsMatch) {
      const issueNumber = Number(commentsMatch[1]);

      if (req.method === 'GET') {
        res
          .writeHead(200, { 'Content-Type': 'application/json' })
          .end(JSON.stringify(comments.getComments(issueNumber)));
        return;
      }

      if (req.method === 'POST') {
        void readJsonBody(req).then((parsed) => {
          const body =
            typeof parsed === 'object' &&
            parsed !== null &&
            typeof (parsed as { body?: unknown }).body === 'string'
              ? (parsed as { body: string }).body
              : '';
          const comment = comments.addComment(issueNumber, body);
          onCommentAdded(issueNumber);
          res.writeHead(201, { 'Content-Type': 'application/json' }).end(JSON.stringify(comment));
        });
        return;
      }
    }

    res
      .writeHead(404, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ message: 'Not Found' }));
  });
}

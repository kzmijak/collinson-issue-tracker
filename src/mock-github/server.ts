import { createServer, type Server } from 'node:http';
import type { GrowingIssueDataset } from './dataset.js';

const ISSUES_PATH = /^\/repos\/[^/]+\/[^/]+\/issues\/?$/;

/**
 * Mirrors just enough of the real GitHub REST shape for the reader to be unable to tell the
 * difference: GET / for a liveness probe, GET /repos/:owner/:repo/issues for the issues list,
 * with an optional ?state= filter that is tolerated but never required.
 */
export function createMockGithubServer(dataset: GrowingIssueDataset): Server {
  return createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (req.method !== 'GET') {
      res
        .writeHead(404, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({ message: 'Not Found' }));
      return;
    }

    if (url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/plain' }).end('mock-github ok');
      return;
    }

    if (ISSUES_PATH.test(url.pathname)) {
      const state = url.searchParams.get('state');
      const issues = dataset.getVisibleIssues().filter((issue) => !state || issue.state === state);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(issues));
      return;
    }

    res
      .writeHead(404, { 'Content-Type': 'application/json' })
      .end(JSON.stringify({ message: 'Not Found' }));
  });
}

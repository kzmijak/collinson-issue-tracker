import { CommentsStore } from './commentsStore.js';
import { GrowingIssueDataset } from './dataset.js';
import { createMockGithubServer } from './server.js';
import { logNewComment, startGithubServiceTerminal } from './terminal.js';

const port = Number(process.env.MOCK_GITHUB_PORT ?? 4123);

const dataset = new GrowingIssueDataset();
const comments = new CommentsStore();
const server = createMockGithubServer(dataset, comments, logNewComment);

server.listen(port, () => {
  console.warn(`mock-github: listening on http://localhost:${port}`);
  dataset.startGrowth();
  startGithubServiceTerminal(dataset, comments);
});

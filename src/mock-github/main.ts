import { CommentsStore } from './commentsStore.js';
import { GrowingIssueDataset } from './dataset.js';
import { createMockGithubServer } from './server.js';
import { logNewComment, repaint } from './terminal.js';

const port = Number(process.env.MOCK_GITHUB_PORT ?? 4123);

const dataset = new GrowingIssueDataset();
const comments = new CommentsStore();
const server = createMockGithubServer(dataset, comments, (issueNumber, author) => {
  logNewComment(issueNumber, author);
  repaint(dataset, comments);
});

server.listen(port, () => {
  dataset.startGrowth();
  repaint(dataset, comments);
});

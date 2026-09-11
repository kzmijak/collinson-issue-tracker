import { GrowingIssueDataset } from './dataset.js';
import { createMockGithubServer } from './server.js';

const port = Number(process.env.MOCK_GITHUB_PORT ?? 4100);

const dataset = new GrowingIssueDataset();
const server = createMockGithubServer(dataset);

server.listen(port, () => {
  console.warn(`mock-github: listening on http://localhost:${port}`);
  dataset.startGrowth();
});

import { loadConfig } from './config.js';
import { createGithubClient } from './githubClient.js';
import { startPoller } from './poller.js';
import { TerminalRenderer } from './terminal.js';

const config = loadConfig();

const client = createGithubClient({
  baseUrl: config.githubApiBaseUrl,
  repo: config.githubRepo,
  token: config.githubToken,
});

startPoller({
  client,
  renderer: new TerminalRenderer(),
  pollIntervalMs: config.pollIntervalMs,
});

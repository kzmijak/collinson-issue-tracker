import { assertMockMode, loadProactiveConfig } from './proactiveConfig.js';
import { fetchIssues, postComment } from './mockGithubClient.js';
import { ProactiveTracker } from './proactivePoller.js';

const config = loadProactiveConfig();

try {
  assertMockMode(config);
} catch (error) {
  console.error(`issue-tracker:proactive: ${(error as Error).message}`);
  process.exit(1);
}

const tracker = new ProactiveTracker(config.baseUrl, {
  fetchIssues,
  postComment,
  onError: (issueNumber, error) => {
    console.error(
      `issue-tracker:proactive: failed to comment on issue #${issueNumber}: ${(error as Error).message}`,
    );
  },
});

function tick(): void {
  void tracker.poll().catch((error: unknown) => {
    console.error(`issue-tracker:proactive: poll failed: ${(error as Error).message}`);
  });
}

console.warn(`issue-tracker:proactive: polling ${config.baseUrl} every ${config.pollIntervalMs}ms`);
tick();
setInterval(tick, config.pollIntervalMs);

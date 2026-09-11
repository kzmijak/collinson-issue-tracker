import { nextConsecutiveFailures, nextPollDelayMs } from './backoff.js';
import type { GithubClient } from './githubClient.js';
import { advanceSeenState, initialSeenState, selectNewIssues } from './issueSelection.js';
import { formatIssueLine, TerminalRenderer } from './terminal.js';

export interface PollerOptions {
  client: GithubClient;
  renderer: TerminalRenderer;
  pollIntervalMs: number;
  scheduleTimeout?: (fn: () => void, delayMs: number) => unknown;
}

/**
 * Runs forever (until the process is killed): poll, render whatever is new, schedule the next
 * poll after a backoff-adjusted gap. State — seen issues and the failure streak — lives only in
 * this closure, so a restart starts blank exactly as the spec asks.
 */
export function startPoller({
  client,
  renderer,
  pollIntervalMs,
  scheduleTimeout = (fn, delayMs) => setTimeout(fn, delayMs),
}: PollerOptions): void {
  let seen = initialSeenState();
  let consecutiveFailures = 0;

  renderer.start();

  const tick = async (): Promise<void> => {
    try {
      const issues = await client.fetchOpenIssues();
      const fresh = selectNewIssues(issues, seen);
      seen = advanceSeenState(seen, issues);
      if (fresh.length > 0) renderer.printIssueLines(fresh.map(formatIssueLine));
      consecutiveFailures = nextConsecutiveFailures(consecutiveFailures, true);
      renderer.clearError();
    } catch (error) {
      consecutiveFailures = nextConsecutiveFailures(consecutiveFailures, false);
      renderer.setError(`ERROR: ${(error as Error).message}`);
    }

    const delay = nextPollDelayMs(pollIntervalMs, consecutiveFailures);
    scheduleTimeout(() => void tick(), delay);
  };

  void tick();
}

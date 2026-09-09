import type { GitHub } from '../github/GitHub.js';
import { formatIssueLine, selectNewOpenIssues } from './issueLines.js';
import type { StatusBar } from './statusBar.js';

export interface ReaderProps {
  github: GitHub;
  statusBar: StatusBar;
  pollIntervalMs: number;
  statusTickMs: number;
}

export interface Reader {
  stop: () => void;
}

export function startReader({
  github,
  statusBar,
  pollIntervalMs,
  statusTickMs,
}: ReaderProps): Reader {
  let lastSeenIssueId = 0;
  let consecutiveFailures = 0;
  let stopped = false;

  let pollTimer: NodeJS.Timeout | undefined;

  const poll = async (): Promise<void> => {
    try {
      const issues = await github.listIssues();
      consecutiveFailures = 0;
      statusBar.clearError();

      for (const issue of selectNewOpenIssues(issues, lastSeenIssueId)) {
        statusBar.log(formatIssueLine(issue));
        lastSeenIssueId = issue.id;
      }
    } catch (error) {
      consecutiveFailures += 1;
      statusBar.setError(error instanceof Error ? error.message : String(error));
    }

    if (stopped) return;
    pollTimer = setTimeout(() => void poll(), backoffDelayMs(pollIntervalMs, consecutiveFailures));
  };

  const statusTimer = setInterval(() => statusBar.tick(), statusTickMs);

  statusBar.show();
  void poll();

  return {
    stop: () => {
      stopped = true;
      clearInterval(statusTimer);
      if (pollTimer) clearTimeout(pollTimer);
    },
  };
}

export function backoffDelayMs(pollIntervalMs: number, consecutiveFailures: number): number {
  return pollIntervalMs * 2 ** consecutiveFailures;
}

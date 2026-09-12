/**
 * Static, code-time-only fixture data for the GitHub API Simulator.
 *
 * The 20 issues below never change shape or content at runtime — only how many of them are
 * *visible* changes, via {@link GrowingIssueDataset}. A real GitHub issue object never carries a
 * `pull_request` field, and that field's absence is exactly what tells a client "this is an
 * issue, not a PR" — so these fixtures must never grow one.
 */

export interface MockIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  body: string;
  user: { login: string };
  created_at: string;
}

const TITLES: readonly string[] = [
  'Poller crashes when GITHUB_REPO is missing',
  'Add retry/backoff to the issues client',
  'Status bar dots never reset after an error',
  'Document the mock GitHub API contract',
  'Support pagination on /issues',
  'Reader should ignore pull requests entirely',
  'Investigate flaky proxy outage test',
  'Add ETag support to reduce request cost',
  'Allow overriding POLL_INTERVAL_MS at runtime',
  'Mock dataset should mirror real issue shape',
  'Terminal output breaks when not a TTY',
  'Add structured logging to the reader',
  'Clarify GITHUB_API_BASE_URL default behaviour',
  'Reader should print issues oldest first',
  'Add a health check endpoint to the simulator',
  'Growing dataset should stop at 20 issues',
  'Backoff should reset immediately after success',
  'Simulator should bind before the reader starts fetching',
  'Add unit tests for the issue diffing logic',
  'Write the acceptance check for this spec',
];

/** Deterministic, oldest (lowest number) first — matches how the reader is expected to print. */
export const ALL_ISSUES: readonly MockIssue[] = TITLES.map((title, index) => {
  const number = index + 1;
  return {
    id: 900_000 + number,
    number,
    title,
    state: number === 3 ? 'closed' : 'open',
    body: `Fixture body for issue #${number}.`,
    user: { login: 'collinson-bot' },
    created_at: new Date(Date.UTC(2026, 0, number)).toISOString(),
  };
});

export const INITIAL_VISIBLE_COUNT = 15;
export const MAX_VISIBLE_COUNT = 20;
export const GROWTH_STEP = 1;
export const GROWTH_INTERVAL_MS = 2_000;

/** Pure growth step, capped at the dataset's total size — easy to unit test without real timers. */
export function growVisibleCount(current: number): number {
  return Math.min(current + GROWTH_STEP, MAX_VISIBLE_COUNT);
}

/**
 * Boots serving {@link INITIAL_VISIBLE_COUNT} issues, then reveals one more every
 * {@link GROWTH_INTERVAL_MS} via a real timer until {@link MAX_VISIBLE_COUNT} is reached, then
 * stops. The underlying 20-issue list itself never changes — only how much of it is visible.
 */
export class GrowingIssueDataset {
  private visibleCount = INITIAL_VISIBLE_COUNT;
  private timer: NodeJS.Timeout | null = null;

  getVisibleIssues(): MockIssue[] {
    return ALL_ISSUES.slice(0, this.visibleCount);
  }

  getVisibleCount(): number {
    return this.visibleCount;
  }

  startGrowth(onGrow?: () => void): void {
    if (this.timer || this.visibleCount >= MAX_VISIBLE_COUNT) return;
    this.timer = setInterval(() => {
      this.visibleCount = growVisibleCount(this.visibleCount);
      onGrow?.();
      if (this.visibleCount >= MAX_VISIBLE_COUNT) this.stop();
    }, GROWTH_INTERVAL_MS);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}

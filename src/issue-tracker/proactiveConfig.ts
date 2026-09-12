export interface ProactiveConfig {
  githubMode: string;
  baseUrl: string;
  pollIntervalMs: number;
}

export function loadProactiveConfig(env: NodeJS.ProcessEnv = process.env): ProactiveConfig {
  const port = Number(env.MOCK_GITHUB_PORT ?? 4123);

  return {
    githubMode: env.GITHUB_MODE ?? '',
    baseUrl: env.MOCK_GITHUB_URL ?? `http://localhost:${port}`,
    pollIntervalMs: Number(env.ISSUES_TRACKER_POLL_INTERVAL_MS ?? 2000),
  };
}

/** Hard gate: the prod GitHub client doesn't exist until Beta, so anything but 'mock' must refuse to start. */
export function assertMockMode(config: ProactiveConfig): void {
  if (config.githubMode !== 'mock') {
    throw new Error(
      `GITHUB_MODE must be 'mock' (got: ${config.githubMode || '<unset>'}) — prod GitHub is out of scope until Beta`,
    );
  }
}

export interface ProactiveConfig {
  githubMode: string;
  baseUrl: string;
  pollIntervalMs: number;
}

export function loadProactiveConfig(env: NodeJS.ProcessEnv = process.env): ProactiveConfig {
  const port = Number(env.MOCK_GITHUB_PORT ?? 4001);

  return {
    githubMode: env.GITHUB_MODE ?? '',
    baseUrl: `http://localhost:${port}`,
    pollIntervalMs: Number(env.ISSUE_TRACKER_POLL_MS ?? 1000),
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

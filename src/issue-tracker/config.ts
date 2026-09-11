export interface ReaderConfig {
  githubToken?: string;
  githubRepo: string;
  githubApiBaseUrl: string;
  pollIntervalMs: number;
}

/** Binding convention from the spec: GITHUB_API_BASE_URL falls back to the local mock's port. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): ReaderConfig {
  const mockGithubPort = Number(env.MOCK_GITHUB_PORT ?? 4123);
  const githubRepo = env.GITHUB_REPO;

  if (!githubRepo) {
    throw new Error('GITHUB_REPO is required, e.g. kzmijak/collinson-issue-tracker');
  }

  return {
    githubToken: env.GITHUB_TOKEN,
    githubRepo,
    githubApiBaseUrl: env.GITHUB_API_BASE_URL ?? `http://localhost:${mockGithubPort}`,
    pollIntervalMs: Number(env.POLL_INTERVAL_MS ?? 1000),
  };
}

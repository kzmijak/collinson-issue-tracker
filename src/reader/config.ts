import type { GitHubApiMode } from '../github/GitHub.js';

const API_MODES: readonly GitHubApiMode[] = ['mock', 'real'];
const REPO_PATTERN = /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/;

export interface ReaderConfig {
  repo: string;
  pollIntervalSeconds: number;
  apiMode: GitHubApiMode;
  mockFailCount: number;
}

export class ConfigError extends Error {}

export function parseReaderConfig(env: NodeJS.ProcessEnv): ReaderConfig {
  return {
    repo: parseRepo(read(env, 'GITHUB_REPO')),
    pollIntervalSeconds: parsePollInterval(read(env, 'POLL_INTERVAL_SECONDS')),
    apiMode: parseApiMode(read(env, 'GITHUB_API_MODE')),
    mockFailCount: parseMockFailCount(read(env, 'GITHUB_MOCK_FAIL_COUNT')),
  };
}

function read(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const value = env[name]?.trim();
  return value ? value : undefined;
}

function parseApiMode(value: string | undefined): GitHubApiMode {
  if (!value) {
    throw new ConfigError(
      `GITHUB_API_MODE is required — set it to one of: ${API_MODES.join(', ')}`,
    );
  }
  if (!isApiMode(value)) {
    throw new ConfigError(
      `GITHUB_API_MODE must be one of: ${API_MODES.join(', ')} — received '${value}'`,
    );
  }
  return value;
}

function isApiMode(value: string): value is GitHubApiMode {
  return API_MODES.includes(value as GitHubApiMode);
}

function parseRepo(value: string | undefined): string {
  if (!value) throw new ConfigError('GITHUB_REPO is required — set it to owner/repo');
  if (!REPO_PATTERN.test(value)) {
    throw new ConfigError(`GITHUB_REPO must be owner/repo — received '${value}'`);
  }
  return value;
}

function parsePollInterval(value: string | undefined): number {
  if (!value) {
    throw new ConfigError('POLL_INTERVAL_SECONDS is required — set it to a positive number');
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    throw new ConfigError(`POLL_INTERVAL_SECONDS must be a positive number — received '${value}'`);
  }
  return seconds;
}

function parseMockFailCount(value: string | undefined): number {
  if (!value) return 0;

  const count = Number(value);
  if (!Number.isInteger(count) || count < 0) {
    throw new ConfigError(
      `GITHUB_MOCK_FAIL_COUNT must be a non-negative integer — received '${value}'`,
    );
  }
  return count;
}

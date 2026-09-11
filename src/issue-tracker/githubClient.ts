import type { Issue } from './types.js';

export interface GithubClientOptions {
  baseUrl: string;
  repo: string;
  token?: string;
}

/**
 * The one HTTP call this whole reader makes. It has no notion of "mock vs real" — it just hits
 * whatever GITHUB_API_BASE_URL points at, exactly the way it would hit api.github.com.
 */
export function createGithubClient({ baseUrl, repo, token }: GithubClientOptions) {
  const url = `${baseUrl.replace(/\/$/, '')}/repos/${repo}/issues?state=open`;

  return {
    async fetchOpenIssues(): Promise<Issue[]> {
      const response = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });

      if (!response.ok) {
        throw new Error(`GET ${url} -> ${response.status} ${response.statusText}`);
      }

      const body: unknown = await response.json();
      if (!Array.isArray(body)) {
        throw new Error(`GET ${url} -> expected an array, got ${typeof body}`);
      }
      return body as Issue[];
    },
  };
}

export type GithubClient = ReturnType<typeof createGithubClient>;

export type GitHubApiMode = 'mock' | 'real';

export type GitHubIssueState = 'open' | 'closed';

export interface GitHubUser {
  login: string;
  id: number;
}

export interface GitHubLabel {
  id: number;
  name: string;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  state: GitHubIssueState;
  body: string | null;
  user: GitHubUser | null;
  labels: GitHubLabel[];
  html_url: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface GitHub {
  listIssues: () => Promise<readonly GitHubIssue[]>;
}

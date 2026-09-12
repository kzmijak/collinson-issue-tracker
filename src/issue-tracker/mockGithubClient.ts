export interface MockComment {
  author: string;
  body: string;
  createdAt: string;
}

export interface MockIssueSummary {
  id: number;
  title: string;
  comments: MockComment[];
}

export async function fetchIssues(baseUrl: string): Promise<MockIssueSummary[]> {
  const response = await fetch(`${baseUrl}/issues`);
  if (!response.ok) {
    throw new Error(`GET /issues failed: ${response.status}`);
  }
  return (await response.json()) as MockIssueSummary[];
}

export async function postComment(
  baseUrl: string,
  issueNumber: number,
  body: string,
  author: string,
): Promise<void> {
  const response = await fetch(`${baseUrl}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body, author }),
  });
  if (!response.ok) {
    throw new Error(`POST /issues/${issueNumber}/comments failed: ${response.status}`);
  }
}

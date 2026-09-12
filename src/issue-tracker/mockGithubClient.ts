export interface MockIssueSummary {
  number: number;
  title: string;
  comments_count: number;
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
): Promise<void> {
  const response = await fetch(`${baseUrl}/issues/${issueNumber}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ body }),
  });
  if (!response.ok) {
    throw new Error(`POST /issues/${issueNumber}/comments failed: ${response.status}`);
  }
}

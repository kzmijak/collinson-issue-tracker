import type { CommentsStore } from './commentsStore.js';
import type { GrowingIssueDataset, MockIssue } from './dataset.js';

let snapshotCounter = 0;

const DEFAULT_FALLBACK_CAP = 200;

/** Cap replaced wholesale by MOCK_GITHUB_BUFFER_CAP when set; otherwise TTY rows capped at 200. */
function resolveBufferCap(): number {
  const override = process.env.MOCK_GITHUB_BUFFER_CAP;
  if (override) {
    const parsed = Number(override);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  if (process.stdout.isTTY && typeof process.stdout.rows === 'number') {
    return Math.min(process.stdout.rows, DEFAULT_FALLBACK_CAP);
  }
  return DEFAULT_FALLBACK_CAP;
}

/** Writes straight to stdout — the marker/log lines this module prints must never land on stderr. */
function writeLine(line: string): void {
  process.stdout.write(`${line}\n`);
}

function countNonBlank(lines: readonly string[]): number {
  return lines.filter((line) => line.trim() !== '').length;
}

function buildIssueBlock(issue: MockIssue, issueComments: { author: string; body: string }[]): string[] {
  const lines: string[] = [
    `Issues #${issue.number}: (${issueComments.length})`,
    `Title: ${issue.title}`,
    `Content: ${issue.body}`,
    'Comments:',
  ];
  for (const comment of issueComments) {
    lines.push(`  - [${comment.author}]`, `    ${comment.body}`, '');
  }
  lines.push('');
  return lines;
}

/**
 * Full clear + reprint of the entire current issue list, top to bottom, behind a literal
 * `===SNAPSHOT <n> <isoTimestamp>===` marker line so ACCS can split captured stdout into distinct
 * screens even when piped to a file (no ANSI codes survive that reliably). Truncates at issue
 * boundaries once the active buffer cap is hit, always ending a truncated screen with "...".
 */
export function repaint(dataset: GrowingIssueDataset, comments: CommentsStore): void {
  const n = snapshotCounter;
  snapshotCounter += 1;
  const cap = resolveBufferCap();

  if (process.stdout.isTTY) process.stdout.write('\x1B[2J\x1B[H\n');
  writeLine(`===SNAPSHOT ${n} ${new Date().toISOString()}===`);

  const blocks = dataset
    .getVisibleIssues()
    .map((issue) => buildIssueBlock(issue, comments.getComments(issue.number)));
  const totalNonBlank = blocks.reduce((sum, block) => sum + countNonBlank(block), 1);

  if (totalNonBlank <= cap) {
    for (const block of blocks) {
      for (const line of block) writeLine(line);
    }
    return;
  }

  let nonBlankUsed = 1;
  for (const block of blocks) {
    const blockNonBlank = countNonBlank(block);
    if (nonBlankUsed + blockNonBlank > cap - 1) break;
    for (const line of block) writeLine(line);
    nonBlankUsed += blockNonBlank;
  }
  writeLine('...');
}

export function logNewComment(issueNumber: number, author: string): void {
  writeLine(`[comment] issue #${issueNumber} +1 from ${author}`);
}

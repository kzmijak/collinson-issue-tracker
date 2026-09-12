import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { ClaudeCodeLlm, QueryFailedError } from '../llm/ClaudeCodeLlm.js';
import { readAgentPrompt } from '../spec/agentPrompt.js';
import { CommitPlanPrompt } from '../spec/CommitPlanPrompt.js';
import type { CommitPlan } from '../spec/schemas/CommitPlan.js';
import { ModelContractError } from '../spec/EnrichPrompt.js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { amendMetrics, latestMetricsPath, type CommitNote } from '../spec/metrics.js';
import { OUTPUT_DIR } from '../spec/specFolder.js';
import { consoleLogger } from './consoleLogger.js';
import { banner, note, paragraph, section } from './report.js';
import { startProgress } from './progress.js';

const PLANNER_DEFINITION = '.claude/agents/git.md';
const TASK_BUDGET_TOKENS = 30_000;
const DIFF_LIMIT = 60_000;
/**
 * Per file, before the overall limit: one run's diff was a single log full of terminal escapes,
 * which used up the whole limit and left the planner seeing nothing else.
 */
const FILE_DIFF_LIMIT = 4_000;

const TRAILER = [
  'Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>',
  'Claude-Session: https://claude.ai/code/session_01TQu9VtwghwVfh62pUzfamQ',
].join('\n');

const IDENTITY =
  'You plan commits for collinson-issue-tracker. You produce a plan as data; a script performs it.';

function git(...args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
}

function workingTree(): string {
  const status = git('status', '--short');
  if (!status.trim()) return '';

  const truncated = git('diff', 'HEAD')
    .split(/(?=^diff --git )/m)
    .map((file) =>
      file.length > FILE_DIFF_LIMIT
        ? `${file.slice(0, FILE_DIFF_LIMIT)}\n… ${file.length - FILE_DIFF_LIMIT} characters of this file omitted …\n`
        : file,
    )
    .join('')
    .slice(0, DIFF_LIMIT);

  return [
    '## git status --short',
    status,
    '## recent commits',
    git('log', '--oneline', '-8'),
    '## git diff HEAD',
    truncated,
  ].join('\n\n');
}

async function approved(): Promise<boolean> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question('\ncommit this plan? [y/N] ');
  rl.close();

  return /^y(es)?$/i.test(answer.trim());
}

function show(plan: CommitPlan): void {
  section(
    'Proposed commits',
    plan.commits.map((commit) => ({
      title: commit.message.split('\n')[0],
      body: commit.why,
      bullets: commit.files,
    })),
    '+',
    'green',
  );
  section(
    'Left out',
    plan.unassigned.length === 0
      ? []
      : [{ body: 'The planner could not place these.', bullets: plan.unassigned }],
    '?',
    'yellow',
  );
}

async function perform(plan: CommitPlan): Promise<void> {
  const linked = new Set<string>();

  for (const commit of plan.commits) {
    git('reset', 'HEAD', '--');
    git('add', '--', ...commit.files);
    git('commit', '-m', `${commit.message.trim()}\n\n${TRAILER}\n`);

    const subject = commit.message.split('\n')[0];
    const note: CommitNote = {
      at: new Date().toISOString(),
      sha: git('rev-parse', '--short', 'HEAD').trim(),
      subject,
    };
    consoleLogger.info(`committed: ${note.sha} ${subject}`);
    for (const path of await link(commit.files, note)) linked.add(path);
  }
  commitNotes([...linked]);
}

/**
 * The notes can only be written after the commits they name, so they cannot ride inside them. One
 * trailing commit is the honest way out: without it every run of this command leaves the tree dirty
 * with a record of what it just did.
 */
function commitNotes(paths: string[]): void {
  if (paths.length === 0) return;

  git('reset', 'HEAD', '--');
  git('add', '--', ...paths);
  git(
    'commit',
    '-m',
    `chore(metrics): link enrichments to the commits that carried them\n\n` +
      `A commit note names the commit that carried an enrichment into history, so it can only be\n` +
      `written afterwards. This commit is that record.\n\n${TRAILER}\n`,
  );
  consoleLogger.info(`committed: ${git('rev-parse', '--short', 'HEAD').trim()} the notes above`);
}

/**
 * A commit touching a spec's directory is what carried that enrichment into history, so the note
 * goes on the enrichment's own record. Commits that touch no spec leave no note.
 */
async function link(files: string[], note: CommitNote): Promise<string[]> {
  const dirs = new Set(
    files
      .map((file) => /^(specs\/[^/]+)\//.exec(file)?.[1])
      .filter((dir): dir is string => Boolean(dir)),
  );

  const written: string[] = [];

  for (const dir of dirs) {
    const output = join(dir, OUTPUT_DIR);
    const path = await latestMetricsPath(output);
    if (!path) continue;

    const existing = JSON.parse(readFileSync(path, 'utf8')) as { commits?: CommitNote[] };
    await amendMetrics(output, { commits: [...(existing.commits ?? []), note] });
    written.push(path);
  }
  return written;
}

async function main(): Promise<number> {
  const autoApprove = process.argv.slice(2).includes('--auto-approve');
  const state = workingTree();

  if (!state) {
    banner('CLEAN', 'dim', 'working tree');
    paragraph('Nothing to commit.');
    return 0;
  }

  const llm = new ClaudeCodeLlm('claude-sonnet-5', IDENTITY, {
    taskBudgetTokens: TASK_BUDGET_TOKENS,
  });
  const progress = startProgress('planning commits');
  llm.observe(progress.activity);
  const plan = await llm
    .prompt(new CommitPlanPrompt(readAgentPrompt(PLANNER_DEFINITION), state), { fresh: true })
    .finally(progress.stop);

  banner(
    'PLAN',
    'blue',
    `${plan.commits.length} commits`,
    `${Math.round(llm.lastEffectiveTokens).toLocaleString('en-US')} effective tokens`,
  );
  show(plan);

  if (!autoApprove && !(await approved())) {
    note('nothing committed — the working tree is untouched');
    return 1;
  }

  await perform(plan);
  return 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const known = error instanceof ModelContractError || error instanceof QueryFailedError;
    consoleLogger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = known ? 2 : 1;
  });

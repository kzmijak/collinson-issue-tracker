import { apply, type ApplyResult } from '../spec/apply.js';
import { ClaudeCodeLlm } from '../llm/ClaudeCodeLlm.js';
import { PROJECT_CONTEXT, readAgentPrompt } from '../spec/agentPrompt.js';
import { ModelContractError } from '../spec/EnrichPrompt.js';
import { resolveSpecPath, SpecNotFoundError, specName } from '../spec/resolveSpecPath.js';
import { SpecFormatError } from '../spec/SpecFile.js';
import { excerpt } from '../spec/runCheck.js';
import { numberFlag, positional } from './args.js';
import { consoleLogger } from './consoleLogger.js';
import { banner, brief, note, paragraph, section } from './report.js';
import { style } from './format.js';
import { startLive } from './live.js';

/**
 * Sonnet, not opus: a specification this detailed asks for execution rather than invention, and the
 * first unbudgeted opus run cost 5,370,381 effective tokens to reach a blocked verdict.
 *
 * The ceiling is the operator's, in effective tokens, and the rounds share it — three rounds of a
 * full allowance would be three times the number they set. `spec/budget.ts` converts what is
 * left into the plain-token advisory the model is actually given, so it paces itself and delivers a
 * complete smaller answer instead of being cut off mid-edit.
 *
 * `maxTurns` stays as the bound on a runaway that the budget cannot see: a loop with tools and no
 * ceiling has nothing to stop it.
 *
 * The model and the ceiling are the operator's. The other three numbers are picks, recorded in
 * `docs/apply-defaults.md`; `--rounds` and `--budget` override the two most likely to be wrong.
 */
const MODEL = 'claude-sonnet-5';
const EFFECTIVE_TOKEN_BUDGET = 900_000;
const TIME_LIMIT_MS = 30 * 60_000;
const MAX_TURNS = 200;
const ROUNDS = 3;
const CHECK_TIMEOUT_MS = 300_000;

/**
 * Not a narrowing of the toolset — every tool is available. Git writes are denied because
 * `settingSources: []` also keeps out the `PreToolUse` hook that normally guarantees history only
 * moves through `pnpm commit`, and this is the only mechanical barrier left. The identity carries
 * the rule itself, because a pattern list cannot anticipate every spelling of it.
 *
 * specs/ is the operator's and the enrichment's, never the implementer's: one run added a file
 * there to make the ACCS pass. .env holds live tokens: one run printed it into its transcript.
 * A shell command can still reach both; these stop the direct tools.
 */
const DENIED = [
  'Bash(git add:*)',
  'Bash(git commit:*)',
  'Bash(git push:*)',
  'Bash(git reset:*)',
  'Bash(git checkout:*)',
  'Bash(git rebase:*)',
  'Bash(git stash:*)',
  'Edit(./specs/**)',
  'Write(./specs/**)',
  'Read(./.env)',
  'Bash(cat .env:*)',
];

const IDENTITY =
  'You implement specifications for collinson-issue-tracker. You build exactly what the ' +
  'specification says, you record every choice it left open, and you stop when its acceptance ' +
  'check passes.';

const OUTPUT_LIMIT = 700;
const PICKS_SHOWN = 6;

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const rounds = numberFlag(args, '--rounds') ?? ROUNDS;
  const budget = numberFlag(args, '--budget') ?? EFFECTIVE_TOKEN_BUDGET;
  const spec = positional(args, ['--rounds', '--budget']);

  if (!spec) {
    consoleLogger.error(
      'usage: pnpm apply <spec> [--rounds N] [--budget EFFECTIVE_TOKENS] [--force]',
    );
    return 1;
  }

  const path = resolveSpecPath(spec);
  const llm = new ClaudeCodeLlm(MODEL, IDENTITY, {
    tools: 'all',
    denied: DENIED,
    maxTurns: MAX_TURNS,
    presetSystemPrompt: true,
  });
  llm.updateSystemPrompt({ rules: readAgentPrompt(PROJECT_CONTEXT) });
  consoleLogger.info(
    style(
      `${MODEL} · ceiling ${budget.toLocaleString('en-US')} effective tokens · up to ${rounds} rounds`,
      'dim',
    ),
  );

  const live = startLive(`applying ${specName(path)}`);
  const result = await apply(path, llm, {
    model: MODEL,
    effectiveTokenBudget: budget,
    rounds,
    checkTimeoutMs: CHECK_TIMEOUT_MS,
    timeLimitMs: TIME_LIMIT_MS,
    force,
    onActivity: live.activity,
  }).finally(live.stop);

  return report(result, spec, budget);
}

function report(result: ApplyResult, spec: string, budget: number): number {
  if (result.status === 'refused') {
    banner('REFUSED', 'yellow', spec);
    paragraph(result.detail ?? 'refused.');
    if (result.check?.output) showOutput(result.check.output);
    return 2;
  }

  if (result.status === 'nothing-to-do') {
    banner('NOTHING TO DO', 'dim', spec);
    paragraph('The check already passes, so there is nothing left that anyone wrote a case for.');
    return 0;
  }

  const converged = result.status === 'converged';
  const spent = Math.round(result.effectiveTokens);
  const over = spent > budget ? ', over the ceiling' : '';

  banner(
    converged ? 'CONVERGED' : result.status === 'blocked' ? 'BLOCKED' : 'NOT CONVERGED',
    converged ? 'green' : 'red',
    spec,
    `${spent.toLocaleString('en-US')} of ${budget.toLocaleString('en-US')} effective tokens${over}, ${result.rounds} round${result.rounds === 1 ? '' : 's'}`,
  );

  // The full text of all of this is in the metrics record. What reaches the terminal is the verdict
  // and the next action, because a wall of reasoning is where the one useful line goes to hide.
  if (result.implementation) paragraph(brief(result.implementation.summary));

  if (result.implementation?.remedy) {
    section('Do this', [{ body: result.implementation.remedy }], '>', 'yellow');
  }

  if (result.implementation?.blocked) {
    section('Why it stopped', [{ body: brief(result.implementation.blocked) }], 'x', 'red');
  }

  if (result.status === 'budget-exhausted') {
    section(
      'Why it stopped',
      [{ body: 'The ceiling ran out before the check went green. Raise it with `--budget`.' }],
      'x',
      'red',
    );
  }

  if (result.status === 'time-exhausted') {
    section(
      'Why it stopped',
      [
        {
          body: 'The 30-minute limit passed before the check went green. No new round was started.',
        },
      ],
      'x',
      'red',
    );
  }

  const files = result.implementation?.files ?? [];
  if (files.length > 0) {
    section('Files', [{ body: 'Changed, and left unstaged.', bullets: files }], '+', 'green');
  }

  const picks = result.implementation?.picks ?? [];
  section(
    'Picked without being told',
    picks.slice(0, PICKS_SHOWN).map((pick) => ({ body: `${pick.decision} → **${pick.chose}**` })),
    '?',
    'yellow',
  );

  section(
    'Bugs and loopholes in the spec or the ACCS',
    (result.implementation?.specIssues ?? []).map((issue) => ({ body: issue })),
    '!',
    'red',
  );

  if (!converged && result.check) showOutput(result.check.output);

  const rest = picks.length - PICKS_SHOWN;
  if (rest > 0) note(`${rest} more picks, with the reasoning, in the report`);
  if (result.report) note(`report: ${result.report}`);

  if (converged) note('Nothing is staged. Review the tree, then `pnpm commit`.');

  return converged ? 0 : 1;
}

function showOutput(output: string): void {
  section('What the check said', [{ body: excerpt(output.trim(), OUTPUT_LIMIT) }], '>', 'dim');
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    const couldNotRun =
      error instanceof ModelContractError ||
      error instanceof SpecNotFoundError ||
      error instanceof SpecFormatError;
    consoleLogger.error(error instanceof Error ? error.message : String(error));
    process.exitCode = couldNotRun ? 2 : 1;
  });

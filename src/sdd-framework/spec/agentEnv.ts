import { readFileSync } from 'node:fs';

/** The operator's environment for anything the framework starts. Never the operator's own `.env`. */
export const ENV_ROBOTS = '.env.robots';
/** The defaults the implementer maintains. `.env.robots` is layered on top of it, never instead. */
export const ENV_EXAMPLE = '.env.example';

/** What a shell needs to find its tools and home, and nothing about this project. */
const SYSTEM = [
  'PATH',
  'HOME',
  'USER',
  'LOGNAME',
  'SHELL',
  'TERM',
  'LANG',
  'LC_ALL',
  'TMPDIR',
  'TZ',
];

/** What the Claude Code process needs to log in. The acceptance check never gets these. */
const CREDENTIALS = ['CLAUDE_CODE_OAUTH_TOKEN', 'ANTHROPIC_API_KEY', 'CLAUDE_CONFIG_DIR'];

/**
 * The environment an agent and its acceptance check run in: `.env.robots` as if it had been copied
 * to `.env`, never the operator's own `.env`. One run's check passed or failed on the operator's
 * GITHUB_REPO rather than on the code, and the implementer printed the live values to find out
 * why. Whatever the product needs to run has to have a working value in `.env.robots`.
 */
export function checkEnv(path = ENV_ROBOTS): NodeJS.ProcessEnv {
  // Both files, example first: the implementer may only write `.env.example`, so a variable it adds
  // for a new feature would never reach a check that read `.env.robots` alone. The operator's file
  // wins wherever the two disagree.
  return { ...pick(SYSTEM), ...readExample(ENV_EXAMPLE), ...readExample(path) };
}

export function agentEnv(path = ENV_ROBOTS): NodeJS.ProcessEnv {
  const env = { ...checkEnv(path), ...pick(CREDENTIALS) };
  // An empty placeholder would shadow a login kept in ~/.claude.
  for (const name of CREDENTIALS) if (!env[name]) delete env[name];
  return env;
}

function pick(names: string[]): NodeJS.ProcessEnv {
  return Object.fromEntries(
    names
      .filter((name) => process.env[name] !== undefined)
      .map((name) => [name, process.env[name]]),
  );
}

export function readExample(path: string): Record<string, string> {
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return {};
  }

  const values: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

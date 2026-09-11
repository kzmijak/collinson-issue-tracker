import { readFileSync } from 'node:fs';

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
 * The environment an agent and its acceptance check run in: `.env.example` as if it had been copied
 * to `.env`, never the operator's own `.env`. One run's check passed or failed on the operator's
 * GITHUB_REPO rather than on the code, and the implementer printed the live values to find out
 * why. Whatever the product needs to run has to have a working default in `.env.example`.
 */
export function checkEnv(examplePath = ENV_EXAMPLE): NodeJS.ProcessEnv {
  return { ...pick(SYSTEM), ...readExample(examplePath) };
}

export function agentEnv(examplePath = ENV_EXAMPLE): NodeJS.ProcessEnv {
  const env = { ...checkEnv(examplePath), ...pick(CREDENTIALS) };
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

import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { agentEnv, checkEnv } from '../../../src/sdd-framework/spec/agentEnv.js';

function example(text: string): string {
  const path = join(mkdtempSync(join(tmpdir(), 'env-')), '.env.example');
  writeFileSync(path, text);
  return path;
}

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe('checkEnv', () => {
  it('is .env.example as if copied to .env, never what the operator has set', () => {
    process.env.GITHUB_REPO = 'operator/live';
    const env = checkEnv(
      example('# comment\nGITHUB_REPO=owner/repo\nGITHUB_TOKEN=\nQUOTED="a b"\n'),
    );

    expect(env.GITHUB_REPO).toBe('owner/repo');
    expect(env.GITHUB_TOKEN).toBe('');
    expect(env.QUOTED).toBe('a b');
    expect(env.PATH).toBe(process.env.PATH);
  });

  it('keeps Claude credentials out of the acceptance check', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'secret';

    expect(checkEnv(example('CLAUDE_CODE_OAUTH_TOKEN=\n')).CLAUDE_CODE_OAUTH_TOKEN).toBe('');
  });
});

describe('agentEnv', () => {
  it('gives the agent the real credentials over the empty placeholder', () => {
    process.env.CLAUDE_CODE_OAUTH_TOKEN = 'secret';

    expect(agentEnv(example('CLAUDE_CODE_OAUTH_TOKEN=\n')).CLAUDE_CODE_OAUTH_TOKEN).toBe('secret');
  });
});

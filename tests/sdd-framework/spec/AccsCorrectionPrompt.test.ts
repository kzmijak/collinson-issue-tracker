import { describe, expect, it } from 'vitest';
import { ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';
import { AccsCorrectionPrompt } from '../../../src/sdd-framework/spec/AccsCorrectionPrompt.js';
import type { Verification } from '../../../src/sdd-framework/spec/metrics.js';

const verification: Verification = {
  at: '2026-09-09T00:00:00Z',
  verdict: 'rejected',
  summary: 'backoff is never exercised',
  mustFix: [{ area: 'Falsifiability', quote: 'doubles on error', problem: 'never triggered' }],
  shouldFix: [],
  shouldKnow: [],
  effectiveTokens: 1000,
  specSha: 'aaaaaaaaaaaa',
};

const prompt = new AccsCorrectionPrompt(
  'instructions',
  '## Read this first\n\nsome prose',
  '#!/usr/bin/env bash\nexit 1\n',
  'specs/001-thing/accs.bash',
  verification,
);

describe('AccsCorrectionPrompt', () => {
  it('accepts a corrected accs.bash', () => {
    const result = prompt.parseOutput(
      JSON.stringify({
        files: [{ path: 'accs.bash', content: '#!/usr/bin/env bash\necho PASS\n' }],
      }),
    );

    expect(result.files).toHaveLength(1);
  });

  it('refuses an answer with no files', () => {
    expect(() => prompt.parseOutput(JSON.stringify({ files: [] }))).toThrow(ModelContractError);
  });

  it('carries the reviewer verdict, the current script and the reference body, never the operator prose above the marker', () => {
    const message = prompt.createMessage();

    expect(message).toContain('backoff is never exercised');
    expect(message).toContain('doubles on error');
    expect(message).toContain('exit 1');
    expect(message).toContain('some prose');
  });

  it('never tells the ACCS to run the unit suite', () => {
    const message = prompt.createMessage();

    expect(message).not.toContain('pnpm test');
    expect(message).not.toContain('vitest');
  });
});

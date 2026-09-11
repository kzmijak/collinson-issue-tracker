import { describe, expect, it } from 'vitest';
import { ModelContractError } from '../../../src/sdd-framework/spec/EnrichPrompt.js';
import { AccsCorrectionPrompt, AccsPrompt } from '../../../src/sdd-framework/spec/AccsPrompt.js';
import type { Verification } from '../../../src/sdd-framework/spec/metrics.js';

const verification: Verification = {
  at: '2026-09-09T00:00:00Z',
  verdict: 'rejected',
  summary: 'issue numbers collide with other digits',
  mustFix: [{ area: 'Falsifiability', quote: 'grep -qw "$num"', problem: 'passes on noise' }],
  shouldFix: [],
  shouldKnow: [],
  fix: 'accs',
  effectiveTokens: 1000,
  specSha: 'aaaaaaaaaaaa',
};

const sources = {
  accs: 'Start the service and curl it.',
  enrichedSpec: '## Behaviour\n\n| each issue prints as `#<n> <title>` |',
  accsPath: 'specs/001-thing/output/accs.bash',
};

describe('AccsPrompt', () => {
  const prompt = new AccsPrompt(sources);

  it('hands the ACCS author both the operator method and the enriched contract', () => {
    const message = prompt.createMessage();

    expect(message).toContain('Start the service and curl it.');
    expect(message).toContain('each issue prints as `#<n> <title>`');
    expect(message).toContain('specs/001-thing/output/accs.bash');
  });

  it('refuses an answer with no files', () => {
    expect(() => prompt.parseOutput(JSON.stringify({ files: [] }))).toThrow(ModelContractError);
  });
});

describe('AccsCorrectionPrompt', () => {
  const prompt = new AccsCorrectionPrompt(sources, '#!/usr/bin/env bash\nexit 1\n', verification);

  it('accepts a corrected accs.bash', () => {
    const result = prompt.parseOutput(
      JSON.stringify({
        files: [{ path: 'accs.bash', content: '#!/usr/bin/env bash\necho PASS\n' }],
      }),
    );

    expect(result.files).toHaveLength(1);
  });

  it('carries the verdict, the current script, accs.md and the enriched contract', () => {
    const message = prompt.createMessage();

    expect(message).toContain('issue numbers collide with other digits');
    expect(message).toContain('grep -qw "$num"');
    expect(message).toContain('exit 1');
    expect(message).toContain('Start the service and curl it.');
    expect(message).toContain('each issue prints as `#<n> <title>`');
  });

  it('never tells the ACCS to run the unit suite', () => {
    const message = prompt.createMessage();

    expect(message).not.toContain('pnpm test');
    expect(message).not.toContain('vitest');
  });
});

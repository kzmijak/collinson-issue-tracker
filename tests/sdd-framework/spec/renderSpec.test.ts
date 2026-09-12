import { describe, expect, it } from 'vitest';
import type { EnrichedBody } from '../../../src/sdd-framework/spec/schemas/Enrichment.js';
import { renderSpec } from '../../../src/sdd-framework/spec/renderSpec.js';

const body: EnrichedBody = {
  summary: 'Polls a repository and logs its issues.',
  exports: [{ name: 'mock port', value: 'MOCK_GITHUB_PORT=4000', why: 'the check needs it' }],
  drawbacks: ['polling wastes requests when nothing changed'],
  contract: [
    { facade: '`pnpm start` prints `#<n> <title>` per issue', promise: 'one line per open issue' },
  ],
  numbers: 'interval 5000 ms',
  notThis: 'the container · persistent state',
  doneWhen: ['`src/spec/SpecFile.ts` exports `splitSpec`'],
  behaviours: [
    { name: 'configuration', cases: [{ input: 'GITHUB_REPO=a/b/c', expected: 'exits non-zero' }] },
  ],
  decisions: [{ decision: 'Interval is 5000 ms', why: 'the entry of 2026-09-07 says so' }],
  outOfScope: ['pagination'],
  openQuestions: ['Is the token mandatory? Recommendation: yes.'],
  assumptions: [{ question: 'Sort order?', choice: 'API order — the operator named none.' }],
};

const meta = {
  generatedOn: '2026-09-08',
  entries: ['2026-09-07 — first'],
  sourceSha: 'abc123',
  files: ['accs.bash'],
  status: 'draft' as const,
};

describe('renderSpec', () => {
  it('is deterministic for the same input', () => {
    expect(renderSpec(body, meta)).toBe(renderSpec(body, meta));
  });

  it('records the source hash so an unchanged operator section can be detected', () => {
    expect(renderSpec(body, meta)).toContain('source-sha: abc123');
  });

  it('names every entry it was generated from', () => {
    expect(renderSpec(body, meta)).toContain('from: 2026-09-07 — first');
  });

  it('renders the rows, with the ACCS entry point filled in by the framework', () => {
    const output = renderSpec(body, meta);
    for (const row of ['**Check**', '**Numbers**', '**Not this**']) {
      expect(output).toContain(row);
    }
    expect(output).toContain('`bash output/accs.bash`');
  });

  it('renders the contract the ACCS may rely on as its own section', () => {
    const output = renderSpec(body, meta);

    expect(output).toContain('## Contract');
    expect(output).toContain(
      '| `pnpm start` prints `#<n> <title>` per issue | one line per open issue |',
    );
  });

  it('renders behaviour cases as a table, not prose', () => {
    expect(renderSpec(body, meta)).toContain('| GITHUB_REPO=a/b/c | exits non-zero |');
  });

  it('omits the open questions section when there are none', () => {
    expect(renderSpec({ ...body, openQuestions: [] }, meta)).not.toContain('## Open questions');
  });
});

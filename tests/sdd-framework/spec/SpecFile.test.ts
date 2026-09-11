import { describe, expect, it } from 'vitest';
import {
  normalise,
  readEntries,
  readOperatorSection,
  readSectionItems,
  readStatus,
  setStatus,
  sourceSha,
  specSha,
  SpecFormatError,
} from '../../../src/sdd-framework/spec/SpecFile.js';

const section = [
  '# 001 — Prototype issues reader',
  '',
  '## What I want',
  '',
  '### 2026-09-07 — prototype issues reader',
  '',
  'Polls the repo every 5 seconds and logs new issues.',
].join('\n');

const accs = 'Start it, curl the mock, compare with the console.';

describe('readOperatorSection', () => {
  it('returns the whole file when there is no legacy marker', () => {
    expect(readOperatorSection(`${section}\n`)).toBe(section);
  });

  it('ignores whatever an older layout left below the enrich:generated marker', () => {
    const legacy = `${section}\n\n<!-- enrich:generated -->\n\n## Read this first\n\nold body\n`;
    expect(readOperatorSection(legacy)).toBe(section);
  });

  it('refuses a spec without a What I want section', () => {
    expect(() => readOperatorSection(section.replace('## What I want', '## Notes'))).toThrow(
      SpecFormatError,
    );
  });

  it('refuses a What I want section with no dated entry', () => {
    expect(() =>
      readOperatorSection(section.replace('### 2026-09-07 — prototype issues reader', 'prose')),
    ).toThrow(SpecFormatError);
  });

  it('refuses two entries with the same heading', () => {
    const duplicated = `${section}\n\n### 2026-09-07 — prototype issues reader\n\nagain`;
    expect(() => readOperatorSection(duplicated)).toThrow(/distinct label/);
  });

  it('accepts two entries on the same date with different labels', () => {
    const sameDay = `${section}\n\n### 2026-09-07 — token is mandatory\n\nfirst`;
    expect(readEntries(readOperatorSection(sameDay))).toHaveLength(2);
  });
});

describe('sourceSha', () => {
  it('is unchanged when a formatter reflows the prose', () => {
    const reflowed = section.replace('and logs new issues.', 'and logs\nnew issues.');
    expect(sourceSha(reflowed, accs)).toBe(sourceSha(section, accs));
    expect(normalise(reflowed)).toBe(normalise(section));
  });

  it('changes when spec.md gains an entry', () => {
    expect(sourceSha(`${section}\n\n### 2026-09-09 — later\n\nMore.`, accs)).not.toBe(
      sourceSha(section, accs),
    );
  });

  it('changes when accs.md is edited in place', () => {
    expect(sourceSha(section, `${accs} Wait 4 seconds.`)).not.toBe(sourceSha(section, accs));
  });
});

describe('readStatus and setStatus', () => {
  const enriched =
    '<!-- enrich:meta\nsource-sha: abc\nstatus: draft\n-->\n\n## Read this first\n\nbody';

  it('reads the verdict a previous run recorded', () => {
    expect(readStatus(setStatus(enriched, 'rejected'))).toBe('rejected');
  });

  it('treats an enriched spec with no verdict as draft', () => {
    expect(readStatus('<!-- enrich:meta\nsource-sha: abc\n-->')).toBe('draft');
  });

  it('adds the status line when there is none, and changes nothing else', () => {
    const next = setStatus('<!-- enrich:meta\nsource-sha: abc\n-->\n\nbody', 'approved');
    expect(next).toBe('<!-- enrich:meta\nsource-sha: abc\nstatus: approved\n-->\n\nbody\n');
  });
});

describe('specSha', () => {
  const enriched =
    '<!-- enrich:meta\nsource-sha: abc\nstatus: draft\n-->\n\n## Read this first\n\nbody';
  const sha = specSha(section, accs, enriched, 'exit 0');

  it('ignores the status line verify writes itself', () => {
    expect(specSha(section, accs, setStatus(enriched, 'approved'), 'exit 0')).toBe(sha);
  });

  it('changes when the enriched spec changes', () => {
    expect(specSha(section, accs, enriched.replace('body', 'other body'), 'exit 0')).not.toBe(sha);
  });

  it('changes when accs.md changes', () => {
    expect(specSha(section, `${accs} more`, enriched, 'exit 0')).not.toBe(sha);
  });

  it('changes when the ACCS is repaired, so an old verdict is not reused for the new script', () => {
    expect(specSha(section, accs, enriched, 'exit 1')).not.toBe(sha);
  });
});

describe('readSectionItems', () => {
  const generated = [
    '## Open questions',
    '',
    '- First question, which wraps',
    '  onto a second line.',
    '- Second question.',
    '',
    '## Assumptions taken',
    '',
    '- **Sort order?** API order.',
    '',
    '## Done when',
    '',
    '- not a question',
  ].join('\n');

  it('reads the items under a heading', () => {
    expect(readSectionItems(generated, 'Open questions')).toEqual([
      'First question, which wraps onto a second line.',
      'Second question.',
    ]);
  });

  it('stops at the next heading', () => {
    expect(readSectionItems(generated, 'Assumptions taken')).toEqual([
      '**Sort order?** API order.',
    ]);
  });

  it('returns nothing when the heading is absent', () => {
    expect(readSectionItems(generated, 'Nowhere')).toEqual([]);
  });
});

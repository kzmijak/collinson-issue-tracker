import { describe, expect, it } from 'vitest';
import {
  GENERATED_MARKER,
  normaliseHead,
  readEntries,
  readSectionItems,
  readStatus,
  replaceGenerated,
  specSha,
  SpecFormatError,
  splitSpec,
} from '../../../src/sdd-framework/spec/SpecFile.js';

const head = [
  '# 001 — Prototype issues reader',
  '',
  'Status: draft',
  '',
  '## What I want',
  '',
  '### 2026-09-07 — prototype issues reader',
  '',
  'Polls the repo every 5 seconds and logs new issues.',
  '',
  GENERATED_MARKER,
].join('\n');

const spec = `${head}\n\n## Read this first\n\nold body\n`;

describe('splitSpec', () => {
  it('separates the operator section from the generated one', () => {
    const { head: actualHead, generated } = splitSpec(spec);
    expect(actualHead).toBe(head);
    expect(generated).toBe('## Read this first\n\nold body');
  });

  it('refuses a file with no generated marker', () => {
    expect(() => splitSpec(head.replace(GENERATED_MARKER, ''))).toThrow(SpecFormatError);
  });

  it('refuses a file with no What I want section', () => {
    expect(() => splitSpec(spec.replace('## What I want', '## Read this first'))).toThrow(
      SpecFormatError,
    );
  });

  it('refuses a What I want section with no dated entry', () => {
    expect(() =>
      splitSpec(spec.replace('### 2026-09-07 — prototype issues reader', 'some prose')),
    ).toThrow(SpecFormatError);
  });

  it('refuses two entries sharing a heading', () => {
    const duplicated = spec.replace(
      '## What I want\n',
      '## What I want\n\n### 2026-09-07 — prototype issues reader\n\nfirst\n',
    );
    expect(() => splitSpec(duplicated)).toThrow(/distinct label/);
  });

  it('accepts two entries on the same date with different labels', () => {
    const sameDay = spec.replace(
      '## What I want\n',
      '## What I want\n\n### 2026-09-07 — token is mandatory\n\nfirst\n',
    );
    expect(readEntries(splitSpec(sameDay).head)).toHaveLength(2);
  });
});

describe('replaceGenerated', () => {
  it('leaves the operator section byte-identical', () => {
    const next = replaceGenerated(spec, '## Read this first\n\nbrand new body');
    expect(next.startsWith(head)).toBe(true);
    expect(splitSpec(next).head).toBe(head);
  });

  it('replaces everything after the marker', () => {
    const next = replaceGenerated(spec, '## Read this first\n\nbrand new body');
    expect(next).not.toContain('old body');
    expect(next).toContain('brand new body');
  });

  it('is idempotent for the same generated content', () => {
    const once = replaceGenerated(spec, 'body');
    expect(replaceGenerated(once, 'body')).toBe(once);
  });
});

describe('normaliseHead', () => {
  it('is unchanged when a formatter reflows the prose', () => {
    const reflowed = head.replace(
      'Polls the repo every 5 seconds and logs new issues.',
      'Polls the repo every 5 seconds and logs\nnew issues.',
    );
    expect(normaliseHead(reflowed)).toBe(normaliseHead(head));
  });

  it('changes when a word changes', () => {
    const edited = head.replace('every 5 seconds', 'every 30 seconds');
    expect(normaliseHead(edited)).not.toBe(normaliseHead(head));
  });

  it('changes when an entry is appended', () => {
    const appended = head.replace(
      GENERATED_MARKER,
      `### 2026-09-09 — second entry\n\nAnd this.\n\n${GENERATED_MARKER}`,
    );
    expect(normaliseHead(appended)).not.toBe(normaliseHead(head));
  });
});

describe('readStatus', () => {
  it('reads the verdict a previous run recorded', () => {
    expect(readStatus('<!-- enrich:meta\nsource-sha: abc\nstatus: rejected\n-->')).toBe('rejected');
  });

  it('treats a section with no verdict as draft', () => {
    expect(readStatus('<!-- enrich:meta\nsource-sha: abc\n-->')).toBe('draft');
  });
});

describe('specSha', () => {
  const full = `${head}\n\n<!-- enrich:meta\nsource-sha: abc\nstatus: draft\n-->\n\n## Read this first\n\nbody`;

  it('ignores the status line verify writes itself', () => {
    expect(specSha(full.replace('status: draft', 'status: approved'))).toBe(specSha(full));
  });

  it('changes when the generated half changes', () => {
    expect(specSha(full.replace('body', 'different body'))).not.toBe(specSha(full));
  });

  it('changes when the operator adds an entry', () => {
    const appended = full.replace(
      '### 2026-09-07',
      '### 2026-09-09 — later\n\nMore.\n\n### 2026-09-07',
    );
    expect(specSha(appended)).not.toBe(specSha(full));
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

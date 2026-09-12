import { describe, expect, it } from 'vitest';
import {
  hasMarker,
  markerFor,
  parseClassificationFromComment,
  renderComment,
} from '../../src/issue-tracker/classificationComment.js';
import type { Classification } from '../../src/issue-tracker/classificationTypes.js';

function entry(overrides: Partial<Classification> = {}): Classification {
  return {
    issueId: 7,
    reply: 'This looks like a real bug.',
    priority: 3,
    effortEst: 2,
    meta: { timeInMs: 123, etConsumed: 456, llmConfig: { model: 'm', effort: 'low', thinking: false } },
    ...overrides,
  };
}

describe('classificationComment', () => {
  it('renders a comment whose first line is exactly the marker', () => {
    const rendered = renderComment('003-issues-classifier', entry());
    expect(rendered.split('\n')[0]).toBe(markerFor('003-issues-classifier', 7));
  });

  it('embeds the priority and effort numbers in the rendered table', () => {
    const rendered = renderComment('spec-x', entry({ priority: 5, effortEst: 3 }));
    expect(rendered).toContain('| Priority | 5 |');
    expect(rendered).toContain('| Estimated effort | 3 |');
  });

  it('recognises a body that starts with the marker', () => {
    const rendered = renderComment('spec-x', entry());
    expect(hasMarker(rendered, 'spec-x', 7)).toBe(true);
  });

  it('does not recognise a marker for a different issue or spec', () => {
    const rendered = renderComment('spec-x', entry());
    expect(hasMarker(rendered, 'spec-x', 8)).toBe(false);
    expect(hasMarker(rendered, 'spec-y', 7)).toBe(false);
  });

  it('recovers the full classification from its own rendered comment', () => {
    const original = entry({ priority: 4, effortEst: 3, reply: 'Needs a breaking change.' });
    const rendered = renderComment('spec-x', original);
    expect(parseClassificationFromComment(rendered)).toEqual(original);
  });

  it('returns undefined when the comment carries no data marker', () => {
    expect(parseClassificationFromComment('just a human comment')).toBeUndefined();
  });
});

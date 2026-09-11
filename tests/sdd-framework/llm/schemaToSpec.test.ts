import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { schemaToSpec } from '../../../src/sdd-framework/llm/schemaToSpec.js';

describe('schemaToSpec', () => {
  it('renders each field with its description in place of the value', () => {
    const spec = schemaToSpec(
      z.object({
        summary: z.string().describe('one sentence'),
        verdict: z.enum(['accepted', 'rejected']),
        picks: z.array(z.object({ why: z.string().describe('one sentence') })),
      }),
    );

    expect(spec).toContain('"summary": "<one sentence>"');
    expect(spec).toContain('"verdict": "<accepted | rejected>"');
    expect(spec).toContain('"why": "<one sentence>"');
  });

  it('marks a nullable field, preferring the wrapper description when it adds one', () => {
    const spec = schemaToSpec(
      z.object({
        blocked: z.string().describe('what conflicts').nullable().describe('null when done'),
        quote: z.string().describe('the line').nullable(),
      }),
    );

    expect(spec).toContain('"blocked": "<what conflicts>", // null when done');
    expect(spec).toContain('"quote": "<the line>" // or null');
  });

  it('renders a union as its first option, the shape the model is meant to send', () => {
    const spec = schemaToSpec(
      z.object({
        notes: z.array(z.union([z.object({ area: z.string().describe('area') }), z.string()])),
      }),
    );

    expect(spec).toContain('"area": "<area>"');
  });

  it('puts the separating comma before a comment, never inside it', () => {
    const spec = schemaToSpec(
      z.object({
        files: z.array(z.string()).describe('complete'),
        blocked: z.string().nullable().describe('null when done'),
        last: z.string(),
      }),
    );

    expect(spec).toContain('"files": ["<string>"], // complete');
    expect(spec).toContain('"blocked": "", // null when done');
    expect(spec).not.toContain('\u0001');
  });
});

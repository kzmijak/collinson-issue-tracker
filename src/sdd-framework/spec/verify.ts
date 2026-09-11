import { readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { Llm } from '../llm/Llm.js';
import { readAgentPrompt } from './agentPrompt.js';
import { amendMetrics, latestMetricsPath, type EnrichMetrics } from './metrics.js';
import { readArtefacts } from './readArtefacts.js';
import { VerifyPrompt } from './VerifyPrompt.js';
import type { Verdict } from './schemas/Verdict.js';
import { isEnrichmentStale, setStatus, specSha, splitSpec } from './SpecFile.js';

export const REVIEWER_DEFINITION = '.ai/identities/verifier.md';

export interface VerifyResult extends Verdict {
  effectiveTokens: number;
  attachedTo: string | null;
  /** True when this verdict was read from the record rather than paid for again. */
  reused: boolean;
}

export class StaleEnrichmentError extends Error {}

export async function verify(path: string, llm: Llm, force = false): Promise<VerifyResult> {
  const source = await readFile(path, 'utf8');
  if (isEnrichmentStale(splitSpec(source))) {
    throw new StaleEnrichmentError(
      'the operator section changed since the last enrichment — run `pnpm enrich` first.',
    );
  }
  const sha = specSha(source);

  const stored = force ? null : await storedVerdict(dirname(path), sha);
  if (stored) return { ...stored, effectiveTokens: 0, attachedTo: null, reused: true };

  const instructions = readAgentPrompt(REVIEWER_DEFINITION, { without: ['Output format'] });
  const artefacts = await readArtefacts(dirname(path));

  try {
    const verdict = await llm.prompt(new VerifyPrompt(source, artefacts, instructions), {
      fresh: true,
    });
    const effectiveTokens = llm.lastEffectiveTokens;

    await writeFile(path, setStatus(source, verdict.verdict), 'utf8');
    const attachedTo = await amendMetrics(dirname(path), {
      verification: {
        at: new Date().toISOString(),
        verdict: verdict.verdict,
        summary: verdict.summary,
        mustFix: verdict.mustFix,
        shouldFix: verdict.shouldFix,
        shouldKnow: verdict.shouldKnow,
        effectiveTokens,
        specSha: sha,
      },
    });

    return { ...verdict, effectiveTokens, attachedTo, reused: false };
  } catch (error) {
    // The client records usage as soon as its query returns, before parsing can reject the shape —
    // so a call that threw here still spent real tokens, and losing that number on top of the
    // failure is a second, quieter defect layered on the first.
    await amendMetrics(dirname(path), {
      verificationFailure: {
        at: new Date().toISOString(),
        effectiveTokens: llm.lastEffectiveTokens,
        specSha: sha,
        detail: error instanceof Error ? error.message : String(error),
      },
    });
    throw error;
  }
}

/** A verdict already paid for, when the spec has not changed since. */
async function storedVerdict(specDir: string, sha: string): Promise<Verdict | null> {
  const path = await latestMetricsPath(specDir);
  if (!path) return null;

  const record = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  const previous = record.verification;

  return previous?.specSha === sha ? { ...previous } : null;
}

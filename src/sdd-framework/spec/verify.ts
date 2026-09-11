import { readFile, writeFile } from 'node:fs/promises';
import type { Llm } from '../llm/Llm.js';
import { readAgentPrompt } from './agentPrompt.js';
import { amendMetrics, latestMetricsPath, type EnrichMetrics } from './metrics.js';
import { readArtefacts } from './readArtefacts.js';
import { VerifyPrompt } from './VerifyPrompt.js';
import type { Verdict } from './schemas/Verdict.js';
import { setStatus, specSha } from './SpecFile.js';
import { describeSpec, isStale, readSpecFolder } from './specFolder.js';
import { latestReport, verifyReport, writeReport } from './reports.js';
import { specName } from './resolveSpecPath.js';

export const REVIEWER_DEFINITION = '.ai/identities/verifier.md';

export interface VerifyResult extends Verdict {
  effectiveTokens: number;
  attachedTo: string | null;
  /** True when this verdict was read from the record rather than paid for again. */
  reused: boolean;
  /** Where this run's report was written; null when the verdict was reused. */
  report: string | null;
  /** For a reused verdict, the report of the run that paid for it. */
  lastReport?: string | null;
}

export class StaleEnrichmentError extends Error {}

export async function verify(path: string, llm: Llm, force = false): Promise<VerifyResult> {
  const startedAt = Date.now();
  const folder = await readSpecFolder(path);
  const { output } = folder.paths;

  if (isStale(folder)) {
    throw new StaleEnrichmentError(
      folder.enriched
        ? 'spec.md or accs.md changed since the last enrichment — run `pnpm enrich` first.'
        : 'this spec has never been enriched — run `pnpm enrich` first.',
    );
  }
  const artefacts = await readArtefacts(output);
  const sha = specSha(folder.operatorSection, folder.accs, folder.enriched, artefacts);

  const stored = force ? null : await storedVerdict(output, sha);
  if (stored) {
    const lastReport = await latestReport(output, 'verify');
    return {
      ...stored,
      effectiveTokens: 0,
      attachedTo: null,
      reused: true,
      report: null,
      lastReport,
    };
  }

  const instructions = readAgentPrompt(REVIEWER_DEFINITION, { without: ['Output format'] });

  try {
    const verdict = await llm.prompt(
      new VerifyPrompt(describeSpec(folder), artefacts, instructions),
      {
        fresh: true,
      },
    );
    const effectiveTokens = llm.lastEffectiveTokens;

    await writeFile(folder.paths.enriched, setStatus(folder.enriched, verdict.verdict), 'utf8');
    const attachedTo = await amendMetrics(output, {
      verification: {
        at: new Date().toISOString(),
        verdict: verdict.verdict,
        summary: verdict.summary,
        mustFix: verdict.mustFix,
        shouldFix: verdict.shouldFix,
        shouldKnow: verdict.shouldKnow,
        fix: verdict.fix,
        effectiveTokens,
        specSha: sha,
      },
    });

    const report = await writeReport(
      output,
      'verify',
      new Date().toISOString(),
      verifyReport(
        {
          spec: specName(path),
          at: new Date(startedAt).toISOString(),
          durationMs: Date.now() - startedAt,
          effectiveTokens,
        },
        verdict,
      ),
    );

    return { ...verdict, effectiveTokens, attachedTo, reused: false, report };
  } catch (error) {
    // The client records usage as soon as its query returns, before parsing can reject the shape —
    // so a call that threw here still spent real tokens, and losing that number on top of the
    // failure is a second, quieter defect layered on the first.
    await amendMetrics(output, {
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
async function storedVerdict(outputDir: string, sha: string): Promise<Verdict | null> {
  const path = await latestMetricsPath(outputDir);
  if (!path) return null;

  const record = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  const previous = record.verification;

  if (previous?.specSha !== sha) return null;
  return { ...previous, fix: previous.fix === 'accs' ? 'accs' : 'full' };
}

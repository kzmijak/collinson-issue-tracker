import { readdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Llm } from '../llm/Llm.js';
import { readAgentPrompt } from './agentPrompt.js';
import { amendMetrics, latestMetricsPath, METRICS_DIR, type EnrichMetrics } from './metrics.js';
import { VerifyPrompt, type Verdict } from './VerifyPrompt.js';
import { setStatus, specSha, splitSpec } from './SpecFile.js';

export const REVIEWER_DEFINITION = '.claude/agents/spec-reviewer.md';

export interface VerifyResult extends Verdict {
  effectiveTokens: number;
  attachedTo: string | null;
  /** True when this verdict was read from the record rather than paid for again. */
  reused: boolean;
}

export async function verify(path: string, llm: Llm, force = false): Promise<VerifyResult> {
  const source = await readFile(path, 'utf8');
  splitSpec(source);
  const sha = specSha(source);

  const stored = force ? null : await storedVerdict(dirname(path), sha);
  if (stored) return { ...stored, effectiveTokens: 0, attachedTo: null, reused: true };

  const instructions = readAgentPrompt(REVIEWER_DEFINITION, { without: ['Output format'] });
  const artefacts = await readArtefacts(dirname(path));

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
}

/** A verdict already paid for, when the spec has not changed since. */
async function storedVerdict(specDir: string, sha: string): Promise<Verdict | null> {
  const path = await latestMetricsPath(specDir);
  if (!path) return null;

  const record = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  const previous = record.verification;

  return previous?.specSha === sha ? { ...previous } : null;
}

const ARTEFACT_LIMIT = 20_000;

/**
 * Everything the spec generated alongside itself. Without these the verifier cannot see whether the
 * check can fail — its most important question — and it correctly complains that the contract is
 * delegated to a file it was never shown.
 */
async function readArtefacts(specDir: string): Promise<string> {
  const names = await readdir(specDir).catch(() => [] as string[]);
  const parts: string[] = [];

  for (const name of names.sort()) {
    if (name === 'spec.md' || name === METRICS_DIR) continue;

    const target = join(specDir, name);
    if (!(await stat(target)).isFile()) continue;

    const content = await readFile(target, 'utf8');
    parts.push(
      `### ${name}\n\n${content.length > ARTEFACT_LIMIT ? `${content.slice(0, ARTEFACT_LIMIT)}\n… truncated …` : content}`,
    );
  }
  return parts.join('\n\n');
}

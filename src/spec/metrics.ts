import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Finding } from './VerifyPrompt.js';
import { slug } from '../llm/slug.js';
import type { TokenUsage } from '../llm/Llm.js';

export const METRICS_DIR = 'metrics';

export type Outcome =
  | 'written'
  | 'blocked'
  | 'unchanged'
  | 'contract-error'
  | 'refused'
  | 'query-failed'
  | 'verified'
  | 'verification-failed';

export interface Verification {
  at: string;
  verdict: 'accepted' | 'rejected';
  summary: string;
  mustFix: Finding[];
  shouldFix: Finding[];
  shouldKnow: Finding[];
  effectiveTokens: number;
  /** The spec this verdict is about, so verifying twice over unchanged content costs once. */
  specSha: string;
}

export interface CommitNote {
  at: string;
  sha: string;
  subject: string;
}

export interface EnrichMetrics {
  at: string;
  durationMs: number;
  entry: string | null;
  sourceSha: string;
  model: string;
  taskBudgetTokens?: number;
  usage: TokenUsage;
  effectiveTokens: number;
  outcome: Outcome;
  detail?: string;
  files?: string[];
  pruned?: string[];
  counts?: Record<string, number>;
  /** Set when this run corrected a previous answer, naming the verdict it acted on. */
  fixedFrom?: string;
  /** Appended by `pnpm verify`, so one file carries the whole life of one enrichment. */
  verification?: Verification;
  /** Appended by `pnpm commit`, linking the enrichment to what carried it into history. */
  commits?: CommitNote[];
}

/**
 * One file per run, named by when it happened and which dated entry prompted it, so a section
 * enriched more than once keeps every attempt side by side. Failures are recorded too: a run that
 * produced nothing still spent tokens, and a record that only keeps successes understates the cost
 * of getting there.
 */
export async function writeMetrics(specDir: string, metrics: EnrichMetrics): Promise<string> {
  const dir = join(specDir, METRICS_DIR);
  await mkdir(dir, { recursive: true });

  const path = join(dir, `${fileStamp(metrics.at)}--${slug(labelOf(metrics.entry))}.json`);
  await writeFile(path, `${JSON.stringify(metrics, null, 2)}\n`, 'utf8');

  return path;
}

/** The entry heading carries its own date; the filename already has a finer one. */
function labelOf(entry: string | null): string {
  return entry?.replace(/^\d{4}-\d{2}-\d{2}\s*[—-]\s*/, '') ?? 'no-entry';
}

function fileStamp(iso: string): string {
  return iso.replace(/\.\d+/, '').replace(/:/g, '-');
}

/** The most recent run's record, or null when this spec has never been enriched with metrics on. */
export async function latestMetricsPath(specDir: string): Promise<string | null> {
  const dir = join(specDir, METRICS_DIR);
  const names = await readdir(dir).catch(() => [] as string[]);
  const latest = names
    .filter((name) => name.endsWith('.json'))
    .sort()
    .at(-1);

  return latest ? join(dir, latest) : null;
}

/**
 * Adds to the latest run's record rather than starting a new one. Returns null when there is
 * nothing to add to — a verdict about an enrichment that predates metrics has nowhere to live, and
 * inventing a record for it would fabricate a run that was never measured.
 */
export async function amendMetrics(
  specDir: string,
  patch: Partial<EnrichMetrics>,
): Promise<string | null> {
  const path = await latestMetricsPath(specDir);
  if (!path) return null;

  const existing = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  await writeFile(path, `${JSON.stringify({ ...existing, ...patch }, null, 2)}\n`, 'utf8');

  return path;
}

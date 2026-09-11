import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Llm } from '../llm/Llm.js';
import { readAgentPrompt } from './agentPrompt.js';
import { latestMetricsPath, writeMetrics, type EnrichMetrics } from './metrics.js';
import { readEntries, setStatus, splitSpec } from './SpecFile.js';
import { AccsCorrectionPrompt } from './AccsCorrectionPrompt.js';
import { ACCS_SCRIPT, writeGeneratedFiles } from './specFiles.js';

export const ENRICHER_DEFINITION = '.ai/identities/enricher.md';

export type EnrichAccsStatus = 'written' | 'nothing-to-fix' | 'refused';

export interface EnrichAccsResult {
  status: EnrichAccsStatus;
  files: string[];
  effectiveTokens: number;
  detail?: string;
}

export interface EnrichAccsContext {
  model: string;
  taskBudgetTokens?: number;
}

/**
 * `pnpm enrich --accs` is a narrower repair than `pnpm enrich`: it exists because the ordinary
 * correction round regenerates the whole generated half from a verdict that was only ever about
 * the check, at full cost and at the risk of drifting prose a reviewer already read and approved.
 * This one touches accs.bash and nothing else the operator or a reviewer has seen before.
 */
export async function enrichAccs(
  path: string,
  llm: Llm,
  context: EnrichAccsContext,
): Promise<EnrichAccsResult> {
  const specDir = dirname(path);
  const startedAt = Date.now();
  const source = await readFile(path, 'utf8');
  const { head, generated } = splitSpec(source);

  const metricsPath = await latestMetricsPath(specDir);
  if (!metricsPath) {
    return refused('no enrichment record for this spec — run `pnpm enrich` first.');
  }

  const record = JSON.parse(await readFile(metricsPath, 'utf8')) as EnrichMetrics;
  const verification = record.verification;
  const findingCount = (verification?.mustFix.length ?? 0) + (verification?.shouldFix.length ?? 0);

  if (!verification || findingCount === 0) {
    return { status: 'nothing-to-fix', files: [], effectiveTokens: 0 };
  }

  const scriptPath = join(specDir, ACCS_SCRIPT);
  const currentScript = await readFile(scriptPath, 'utf8').catch(() => null);
  if (currentScript === null) {
    return refused(`${scriptPath} does not exist yet — run \`pnpm enrich\` first.`);
  }

  const instructions = readAgentPrompt(ENRICHER_DEFINITION);
  const specBody = stripMeta(generated);

  const correction = await llm.prompt(
    new AccsCorrectionPrompt(instructions, specBody, currentScript, ACCS_SCRIPT, verification),
    { fresh: true },
  );
  const effectiveTokens = llm.lastEffectiveTokens;

  const files = await writeGeneratedFiles(specDir, correction.files);
  await writeFile(path, setStatus(source, 'draft'), 'utf8');

  await writeMetrics(specDir, {
    at: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    entry: `${readEntries(head).at(-1) ?? 'no-entry'} — accs correction`,
    sourceSha: record.sourceSha,
    model: context.model,
    taskBudgetTokens: context.taskBudgetTokens,
    usage: llm.totalUsage,
    effectiveTokens,
    outcome: 'written',
    files,
    fixedFrom: verification.verdict,
  });

  return { status: 'written', files, effectiveTokens };
}

/** The meta comment is bookkeeping for the tool, not part of what the check has to prove. */
function stripMeta(generated: string): string {
  return generated.replace(/<!-- enrich:meta[\s\S]*?-->\s*/, '').trim();
}

function refused(detail: string): EnrichAccsResult {
  return { status: 'refused', files: [], effectiveTokens: 0, detail };
}

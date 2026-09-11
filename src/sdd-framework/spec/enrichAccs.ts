import { readFile, writeFile } from 'node:fs/promises';
import type { Llm } from '../llm/Llm.js';
import { latestMetricsPath, writeMetrics, type EnrichMetrics } from './metrics.js';
import { readEntries, setStatus } from './SpecFile.js';
import { isStale, readSpecFolder, withoutMeta } from './specFolder.js';
import { AccsCorrectionPrompt } from './AccsPrompt.js';
import { writeGeneratedFiles } from './specFiles.js';
import { accsFixReport, writeReport } from './reports.js';
import { specName } from './resolveSpecPath.js';

export type EnrichAccsStatus = 'written' | 'nothing-to-fix' | 'refused';

export interface EnrichAccsResult {
  status: EnrichAccsStatus;
  files: string[];
  effectiveTokens: number;
  detail?: string;
  report?: string;
}

export interface EnrichAccsContext {
  model: string;
  taskBudgetTokens?: number;
}

/**
 * `pnpm enrich --accs` is a narrower repair than `pnpm enrich`: when the verdict was only about the
 * ACCS, regenerating the enriched spec too costs a full run and risks drifting prose a reviewer
 * already approved. This one rewrites the ACCS from what is there and touches nothing else.
 */
export async function enrichAccs(
  path: string,
  llm: Llm,
  context: EnrichAccsContext,
): Promise<EnrichAccsResult> {
  const startedAt = Date.now();
  const folder = await readSpecFolder(path);
  const { output } = folder.paths;

  if (isStale(folder)) {
    return refused('spec.md or accs.md changed since the last enrichment — run `pnpm enrich`.');
  }

  const metricsPath = await latestMetricsPath(output);
  if (!metricsPath) {
    return refused('no enrichment record for this spec — run `pnpm enrich` first.');
  }

  const record = JSON.parse(await readFile(metricsPath, 'utf8')) as EnrichMetrics;
  const verification = record.verification;
  const findingCount = (verification?.mustFix.length ?? 0) + (verification?.shouldFix.length ?? 0);

  if (!verification || findingCount === 0) {
    return { status: 'nothing-to-fix', files: [], effectiveTokens: 0 };
  }

  const scriptPath = folder.paths.accsScript;
  const currentScript = await readFile(scriptPath, 'utf8').catch(() => null);
  if (currentScript === null) {
    return refused(`${scriptPath} does not exist yet — run \`pnpm enrich\` first.`);
  }

  const correction = await llm.prompt(
    new AccsCorrectionPrompt(
      { accs: folder.accs, enrichedSpec: withoutMeta(folder.enriched), accsPath: scriptPath },
      currentScript,
      verification,
    ),
    { fresh: true },
  );
  const effectiveTokens = llm.lastEffectiveTokens;

  const files = await writeGeneratedFiles(output, correction.files);
  await writeFile(folder.paths.enriched, setStatus(folder.enriched, 'draft'), 'utf8');

  await writeMetrics(output, {
    at: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    entry: `${readEntries(folder.operatorSection).at(-1) ?? 'no-entry'} — accs correction`,
    sourceSha: record.sourceSha,
    model: context.model,
    taskBudgetTokens: context.taskBudgetTokens,
    usage: llm.totalUsage,
    effectiveTokens,
    outcome: 'written',
    files,
    fixedFrom: verification.verdict,
  });

  const report = await writeReport(
    output,
    'accs-fix',
    new Date().toISOString(),
    accsFixReport(
      {
        spec: specName(path),
        at: new Date(startedAt).toISOString(),
        durationMs: Date.now() - startedAt,
        effectiveTokens,
      },
      verification.summary,
      correction.flow,
    ),
  );

  return { status: 'written', files, effectiveTokens, report };
}

function refused(detail: string): EnrichAccsResult {
  return { status: 'refused', files: [], effectiveTokens: 0, detail };
}

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { Llm, TokenUsage } from '../llm/Llm.js';
import type { EnrichedBody } from './schemas/Enrichment.js';
import { latestMetricsPath, writeMetrics, type EnrichMetrics, type Outcome } from './metrics.js';
import { AccsPrompt } from './AccsPrompt.js';
import { EnrichPrompt, type EnrichMode, type Feedback } from './EnrichPrompt.js';
import { renderSpec } from './renderSpec.js';
import { readEntries, readSectionItems, readStatus } from './SpecFile.js';
import { readSpecFolder, specPaths, withoutMeta } from './specFolder.js';
import { pruneOrphans, readPreviousFiles, writeGeneratedFiles } from './specFiles.js';

export type EnrichResult =
  | {
      status: 'written';
      openQuestions: string[];
      files: string[];
      pruned: string[];
      /** True when a reviewer's verdict was in front of the enricher for this run. */
      corrected: boolean;
      effectiveTokens: number;
    }
  | { status: 'unchanged'; openQuestions: string[]; assumptions: string[] }
  | { status: 'blocked'; blocking: string[]; effectiveTokens: number };

export interface EnrichContext {
  model: string;
  taskBudgetTokens?: number;
  /** Regenerate even when the gate would skip — for a prompt change the hash cannot see. */
  force?: boolean;
}

export interface EnrichAgents {
  /** Expands spec.md into the enriched spec, and writes the contract in it. */
  enricher: Llm;
  /** Turns accs.md into the ACCS, honouring the enriched spec's contract. */
  accsAuthor: Llm;
}

/**
 * Two calls, and nothing is written until both succeed: an enriched spec with no matching ACCS, or
 * the other way round, is the one state the rest of the framework cannot reason about.
 */
export async function enrich(
  path: string,
  agents: EnrichAgents,
  mode: EnrichMode = 'default',
  context: EnrichContext = { model: 'unknown' },
): Promise<EnrichResult> {
  const startedAt = Date.now();
  const paths = specPaths(path);
  const { enricher, accsAuthor } = agents;
  let entry: string | null = null;
  let sourceSha = '';
  let spent = 0;
  let calling: 'enricher' | 'accs-author' | null = null;

  /** A call that threw still spent what its client recorded, so it is counted, not lost. */
  const settle = () => {
    if (calling === 'enricher') spent = enricher.lastEffectiveTokens;
    if (calling === 'accs-author') spent += accsAuthor.lastEffectiveTokens;
    calling = null;
  };

  const record = async (outcome: Outcome, extra: Record<string, unknown> = {}) => {
    await writeMetrics(paths.output, {
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      entry,
      sourceSha,
      model: context.model,
      taskBudgetTokens: context.taskBudgetTokens,
      usage: sumUsage(enricher.totalUsage, accsAuthor.totalUsage),
      effectiveTokens: spent,
      outcome,
      ...extra,
    });
  };

  try {
    return await run();
  } catch (error) {
    settle();
    await record(outcomeOf(error), {
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  async function run(): Promise<EnrichResult> {
    const folder = await readSpecFolder(path);
    const generated = folder.enriched;
    sourceSha = folder.sourceSha;
    entry = readEntries(folder.operatorSection).at(-1) ?? null;

    const feedback = await readFeedback(paths.output, generated, sourceSha);
    const alreadyGenerated = generated.includes(`source-sha: ${sourceSha}`);
    const rejected = readStatus(generated) === 'rejected';

    if (alreadyGenerated && !rejected && !context.force) {
      await record('unchanged');
      return {
        status: 'unchanged',
        openQuestions: readSectionItems(generated, 'Open questions'),
        assumptions: readSectionItems(generated, 'Assumptions taken'),
      };
    }

    calling = 'enricher';
    const enrichment = await enricher.prompt(
      new EnrichPrompt(folder.operatorSection, folder.accs, mode, paths.accsScript, feedback),
      { fresh: true },
    );
    settle();

    if (mode === 'no-questions' && enrichment.body) {
      enrichment.blocking = [];
      enrichment.body.openQuestions = [];
    }

    if (enrichment.blocking.length > 0 || !enrichment.body) {
      await record('blocked', { counts: { blocking: enrichment.blocking.length } });
      return { status: 'blocked', blocking: enrichment.blocking, effectiveTokens: spent };
    }

    const meta = {
      generatedOn: new Date().toISOString().slice(0, 10),
      entries: readEntries(folder.operatorSection),
      sourceSha,
      status: 'draft' as const,
    };
    calling = 'accs-author';
    const accs = await accsAuthor.prompt(
      new AccsPrompt({
        accs: folder.accs,
        enrichedSpec: withoutMeta(renderSpec(enrichment.body, { ...meta, files: [] })),
        accsPath: paths.accsScript,
      }),
      { fresh: true },
    );
    settle();

    const files = await writeGeneratedFiles(paths.output, accs.files);
    const pruned = await pruneOrphans(paths.output, readPreviousFiles(generated), files);

    const body = renderSpec(enrichment.body, { ...meta, files });
    await mkdir(paths.output, { recursive: true });
    await writeFile(paths.enriched, body, 'utf8');
    await record('written', { files, pruned, counts: countsOf(enrichment.body, files) });

    return {
      status: 'written',
      openQuestions: enrichment.body.openQuestions,
      files,
      pruned,
      corrected: Boolean(feedback),
      effectiveTokens: spent,
    };
  }
}

function countsOf(body: EnrichedBody, files: string[]): Record<string, number> {
  return {
    blocking: 0,
    openQuestions: body.openQuestions.length,
    assumptions: body.assumptions.length,
    decisions: body.decisions.length,
    behaviours: body.behaviours.length,
    cases: body.behaviours.reduce((total, behaviour) => total + behaviour.cases.length, 0),
    doneWhen: body.doneWhen.length,
    outOfScope: body.outOfScope.length,
    files: files.length,
  };
}

function outcomeOf(error: unknown): Outcome {
  const name = error instanceof Error ? error.constructor.name : '';
  if (name === 'ModelContractError') return 'contract-error';
  if (name === 'SpecFileEscapeError') return 'refused';
  if (name === 'QueryFailedError') return 'query-failed';
  return 'contract-error';
}

/**
 * A verdict, whenever one exists. Regenerating after a rejection without showing the enricher what
 * was wrong invites the same defect back, so this is not opt-in: the only question is whether the
 * operator has since changed their words, which decides how the findings should be read.
 */
async function readFeedback(
  outputDir: string,
  generated: string,
  sourceSha: string,
): Promise<Feedback | undefined> {
  const path = await latestMetricsPath(outputDir);
  if (!path) return undefined;

  const record = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  if (!record.verification) return undefined;

  return {
    previous: generated,
    operatorSectionChanged: record.sourceSha !== sourceSha,
    ...record.verification,
  };
}

function sumUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
  };
}

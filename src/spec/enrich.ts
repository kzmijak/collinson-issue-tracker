import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { Llm } from '../llm/Llm.js';
import type { EnrichedBody } from './EnrichedSpec.js';
import { latestMetricsPath, writeMetrics, type EnrichMetrics, type Outcome } from './metrics.js';
import { EnrichPrompt, type EnrichMode, type Feedback } from './EnrichPrompt.js';
import { renderSpec } from './renderSpec.js';
import {
  headSha,
  readEntries,
  readSectionItems,
  readStatus,
  replaceGenerated,
  splitSpec,
} from './SpecFile.js';
import { pruneOrphans, readPreviousFiles, TEST_SCRIPT, writeGeneratedFiles } from './specFiles.js';

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

export async function enrich(
  path: string,
  llm: Llm,
  mode: EnrichMode = 'default',
  context: EnrichContext = { model: 'unknown' },
): Promise<EnrichResult> {
  const startedAt = Date.now();
  const specDir = dirname(path);
  let entry: string | null = null;
  let sourceSha = '';

  const record = async (outcome: Outcome, extra: Record<string, unknown> = {}) => {
    await writeMetrics(specDir, {
      at: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      entry,
      sourceSha,
      model: context.model,
      taskBudgetTokens: context.taskBudgetTokens,
      usage: llm.totalUsage,
      effectiveTokens: llm.lastEffectiveTokens,
      outcome,
      ...extra,
    });
  };

  try {
    return await run();
  } catch (error) {
    await record(outcomeOf(error), {
      detail: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  async function run(): Promise<EnrichResult> {
    const source = await readFile(path, 'utf8');
    const { head, generated } = splitSpec(source);
    sourceSha = headSha(head);
    entry = readEntries(head).at(-1) ?? null;

    const feedback = await readFeedback(specDir, generated, sourceSha);
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

    const enrichment = await llm.prompt(
      new EnrichPrompt(head, mode, join(specDir, TEST_SCRIPT), feedback),
      { fresh: true },
    );
    const effectiveTokens = llm.lastEffectiveTokens;

    if (mode === 'no-questions' && enrichment.body) {
      enrichment.blocking = [];
      enrichment.body.openQuestions = [];
    }

    if (enrichment.blocking.length > 0 || !enrichment.body) {
      await record('blocked', { counts: { blocking: enrichment.blocking.length } });
      return { status: 'blocked', blocking: enrichment.blocking, effectiveTokens };
    }

    const files = await writeGeneratedFiles(specDir, enrichment.body.files);
    const pruned = await pruneOrphans(specDir, readPreviousFiles(generated), files);

    const body = renderSpec(enrichment.body, {
      generatedOn: new Date().toISOString().slice(0, 10),
      entries: readEntries(head),
      sourceSha,
      files,
      status: 'unverified',
    });
    await writeFile(path, replaceGenerated(source, body), 'utf8');
    await record('written', { files, pruned, counts: countsOf(enrichment.body) });

    return {
      status: 'written',
      openQuestions: enrichment.body.openQuestions,
      files,
      pruned,
      corrected: Boolean(feedback),
      effectiveTokens,
    };
  }
}

function countsOf(body: EnrichedBody): Record<string, number> {
  return {
    blocking: 0,
    openQuestions: body.openQuestions.length,
    assumptions: body.assumptions.length,
    decisions: body.decisions.length,
    behaviours: body.behaviours.length,
    cases: body.behaviours.reduce((total, behaviour) => total + behaviour.cases.length, 0),
    doneWhen: body.doneWhen.length,
    outOfScope: body.outOfScope.length,
    files: body.files.length,
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
  specDir: string,
  generated: string,
  headSha: string,
): Promise<Feedback | undefined> {
  const path = await latestMetricsPath(specDir);
  if (!path) return undefined;

  const record = JSON.parse(await readFile(path, 'utf8')) as EnrichMetrics;
  if (!record.verification) return undefined;

  return {
    previous: generated,
    operatorSectionChanged: record.sourceSha !== headSha,
    ...record.verification,
  };
}

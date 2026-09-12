import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { accuracyFromPenalty, effortAccuracy, priorityAccuracy } from './scoring.js';
import type { ConfigSummary, HarnessEntry } from './harnessTypes.js';

function summarizeConfig(config: string, entries: HarnessEntry[]): ConfigSummary {
  const combinedScores = entries.map((entry) => accuracyFromPenalty(entry.penalty));
  const priorityScores = entries.map((entry) =>
    entry.arrived ? priorityAccuracy(entry.expectedPriority, entry.actualPriority) : 0,
  );
  const effortScores = entries.map((entry) =>
    entry.arrived ? effortAccuracy(entry.expectedEffort, entry.actualEffort) : 0,
  );
  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    config,
    combinedAccuracy: average(combinedScores),
    priorityAccuracy: average(priorityScores),
    effortAccuracy: average(effortScores),
    failures: entries.filter((entry) => !entry.arrived).length,
    disqualified: entries.some((entry) => entry.disqualified),
    totalEt: entries.reduce((sum, entry) => sum + entry.et, 0),
    totalTimeMs: entries.reduce((sum, entry) => sum + entry.timeMs, 0),
  };
}

export function summarizeByConfig(entries: HarnessEntry[]): ConfigSummary[] {
  const configNames = [...new Set(entries.map((entry) => entry.config))];
  return configNames.map((config) =>
    summarizeConfig(
      config,
      entries.filter((entry) => entry.config === config),
    ),
  );
}

function renderRow(summary: ConfigSummary): string {
  return [
    '',
    summary.config,
    summary.combinedAccuracy.toFixed(4),
    summary.priorityAccuracy.toFixed(4),
    summary.effortAccuracy.toFixed(4),
    summary.failures.toString(),
    summary.disqualified.toString(),
    summary.totalEt.toString(),
    summary.totalTimeMs.toString(),
    '',
  ]
    .join(' | ')
    .trim();
}

export function renderHarnessTable(summaries: ConfigSummary[]): string {
  const header =
    '| config | combined accuracy | priority accuracy | effort accuracy | failures | disqualified | totalEt | totalTimeMs |';
  const divider = '| --- | --- | --- | --- | --- | --- | --- | --- |';
  const rows = summaries.map(renderRow);
  return [header, divider, ...rows].join('\n') + '\n';
}

async function writeGenerated(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

export async function writeHarnessOutputs(
  generatedDir: string,
  specId: string,
  runId: string,
  entries: HarnessEntry[],
): Promise<{ jsonPath: string; mdPath: string }> {
  const jsonPath = `${generatedDir}/${specId}/harness-${runId}.json`;
  const mdPath = `${generatedDir}/${specId}/harness-${runId}.md`;

  await writeGenerated(jsonPath, JSON.stringify(entries, null, 2) + '\n');
  await writeGenerated(mdPath, renderHarnessTable(summarizeByConfig(entries)));

  return { jsonPath, mdPath };
}

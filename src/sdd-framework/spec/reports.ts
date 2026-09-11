import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileStamp, METRICS_DIR } from './metrics.js';
import type { EnrichedBody } from './schemas/Enrichment.js';
import type { Implementation } from './schemas/Implementation.js';
import type { Verdict } from './schemas/Verdict.js';

export type ReportKind = 'enrich' | 'accs-fix' | 'verify' | 'apply';

export interface ReportRun {
  spec: string;
  at: string;
  durationMs: number;
  effectiveTokens: number;
}

/**
 * Written next to the machine record of the same run, for a person who has read nothing but their
 * own spec.md and accs.md. The agents supply the content; the run's cost and duration come from the
 * framework, since no agent can know them.
 */
export async function writeReport(
  outputDir: string,
  kind: ReportKind,
  at: string,
  markdown: string,
): Promise<string> {
  const dir = join(outputDir, METRICS_DIR);
  await mkdir(dir, { recursive: true });

  const path = join(dir, `${fileStamp(at)}--${kind}.md`);
  await writeFile(path, markdown, 'utf8');
  return path;
}

/** The last report of a kind — what a run that had nothing to do hands back instead of a new one. */
export async function latestReport(outputDir: string, kind: ReportKind): Promise<string | null> {
  const dir = join(outputDir, METRICS_DIR);
  const names = await readdir(dir).catch(() => [] as string[]);
  const latest = names
    .filter((name) => name.endsWith(`--${kind}.md`))
    .sort()
    .at(-1);
  return latest ? readFile(join(dir, latest), 'utf8') : null;
}

export function enrichReport(
  run: ReportRun,
  outcome:
    | { status: 'written'; spec: EnrichedBody; accsFlow: string[] }
    | { status: 'blocked'; designFlaws: string[] },
): string {
  if (outcome.status === 'blocked') {
    return document(`Enrichment report — ${run.spec}`, run, 'blocked — nothing was written', [
      section('Design flaws', bullets(outcome.designFlaws)),
    ]);
  }
  const { spec, accsFlow } = outcome;
  return document(`Enrichment report — ${run.spec}`, run, 'written', [
    section(
      'Assumptions made',
      bullets(spec.assumptions.map(({ question, choice }) => `**${question}** ${choice}`)),
    ),
    section('Expected drawbacks', bullets(spec.drawbacks)),
    section('Contract', [
      '| facade | promise |',
      '| ------ | ------- |',
      ...spec.contract.map(({ facade, promise }) => `| ${facade} | ${promise} |`),
    ]),
    section('ACCS — general flow', numbered(accsFlow)),
  ]);
}

export function accsFixReport(run: ReportRun, fixedAfter: string, accsFlow: string[]): string {
  return document(`ACCS fix report — ${run.spec}`, run, 'ACCS rewritten', [
    section('What it was fixed after', [fixedAfter]),
    section('ACCS — general flow', numbered(accsFlow)),
  ]);
}

export function verifyReport(run: ReportRun, verdict: Verdict): string {
  const rejected = verdict.verdict === 'rejected';
  const scope = verdict.fix === 'accs' ? 'the ACCS only' : 'the enriched spec and the ACCS';

  return document(`Verification report — ${run.spec}`, run, verdict.verdict, [
    section('Summary', [verdict.summary]),
    ...(rejected
      ? [
          section('Scope of the fix', [`Redo ${scope}.`]),
          section('Why rejected', findings(verdict.mustFix)),
          section('Should fix', findings(verdict.shouldFix)),
        ]
      : []),
    section('Worth to consider', findings(verdict.shouldKnow)),
  ]);
}

export function applyReport(
  run: ReportRun,
  outcome: { status: string; rounds: number; implementation: Implementation | null },
): string {
  const implementation = outcome.implementation;
  const state = `${outcome.status} after ${outcome.rounds} round${outcome.rounds === 1 ? '' : 's'}`;

  return document(`Implementation report — ${run.spec}`, run, state, [
    section('What was built', [implementation?.summary ?? '(no answer from the implementer)']),
    section(
      'Decisions made outside the spec',
      bullets(
        (implementation?.picks ?? []).map(
          ({ decision, chose, why }) => `**${decision}** ${chose} — ${why}`,
        ),
      ),
    ),
    section(
      'Bugs and loopholes in the spec or the ACCS',
      bullets(implementation?.specIssues ?? []),
    ),
    ...(implementation?.blocked
      ? [section('Why it stopped', [implementation.blocked, implementation.remedy ?? ''])]
      : []),
    section('Files changed', bullets(implementation?.files ?? [])),
  ]);
}

function document(title: string, run: ReportRun, outcome: string, sections: string[][]): string {
  const minutes = Math.floor(run.durationMs / 60_000);
  const seconds = Math.round((run.durationMs % 60_000) / 1000);
  const took = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  const cost = `${Math.round(run.effectiveTokens).toLocaleString('en-US')} ET`;

  return [`# ${title}`, '', `${run.at} · ${outcome} · ${took} · ${cost}`, '', ...sections.flat()]
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trimEnd()
    .concat('\n');
}

function section(heading: string, lines: string[]): string[] {
  return [`## ${heading}`, '', ...(lines.length ? lines : ['(none)']), ''];
}

function bullets(items: string[]): string[] {
  return items.map((item) => `- ${item}`);
}

function numbered(items: string[]): string[] {
  return items.map((item, index) => `${index + 1}. ${item}`);
}

function findings(items: Verdict['mustFix']): string[] {
  return items.map(
    (item) => `- **${item.area}** ${item.quote ? `"${item.quote}" — ` : ''}${item.problem}`,
  );
}

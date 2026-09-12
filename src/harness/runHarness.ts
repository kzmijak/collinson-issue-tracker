import { harnessConfigName, type HarnessLlmConfig } from './harnessConfigs.js';
import { isInjectionFixture, type HarnessFixture } from './harnessFixtures.js';
import { obeyedInjection } from './injection.js';
import { penaltyFor, WORST_PENALTY } from './scoring.js';
import type { HarnessEntry } from './harnessTypes.js';

export interface ClassifyResult {
  reply: string;
  priority: number;
  effortEst: number;
  timeInMs: number;
  etConsumed: number;
}

export type ClassifyFn = (
  issue: { title: string; content: string },
  config: HarnessLlmConfig,
) => Promise<ClassifyResult>;

export interface RunHarnessDeps {
  configs: HarnessLlmConfig[];
  fixtures: HarnessFixture[];
  classify: ClassifyFn;
}

async function classifyOne(
  config: HarnessLlmConfig,
  fixture: HarnessFixture,
  classify: ClassifyFn,
): Promise<HarnessEntry> {
  const expectedPriority = fixture.expected.priority;
  const expectedEffort = fixture.expected.effortEst;

  try {
    const result = await classify({ title: fixture.title, content: fixture.body }, config);
    const penalty = penaltyFor(expectedPriority, expectedEffort, result.priority, result.effortEst);
    const disqualified =
      isInjectionFixture(fixture) && obeyedInjection(fixture.body, result.priority, result.reply);

    return {
      config: harnessConfigName(config),
      issueId: fixture.id,
      expectedPriority,
      expectedEffort,
      actualPriority: result.priority,
      actualEffort: result.effortEst,
      penalty,
      arrived: true,
      et: result.etConsumed,
      timeMs: result.timeInMs,
      disqualified,
    };
  } catch {
    return {
      config: harnessConfigName(config),
      issueId: fixture.id,
      expectedPriority,
      expectedEffort,
      actualPriority: 0,
      actualEffort: 0,
      penalty: WORST_PENALTY,
      arrived: false,
      et: 0,
      timeMs: 0,
      disqualified: false,
    };
  }
}

/** Every configured config against every configured fixture, one call per pair, never batched. */
export async function runHarness(deps: RunHarnessDeps): Promise<HarnessEntry[]> {
  const entries: HarnessEntry[] = [];
  for (const config of deps.configs) {
    for (const fixture of deps.fixtures) {
      entries.push(await classifyOne(config, fixture, deps.classify));
    }
  }
  return entries;
}

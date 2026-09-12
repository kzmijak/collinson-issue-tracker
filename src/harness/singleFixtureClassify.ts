import type { HarnessLlmConfig } from './harnessConfigs.js';
import { findHarnessFixture, type HarnessFixture } from './harnessFixtures.js';
import type { ClassifyFn } from './runHarness.js';

export interface SingleFixtureResult {
  priority: number;
  effort: number;
  et: number;
  timeMs: number;
}

/**
 * Backs `pnpm classify --harness --issue-id`: looks the issue up in the fixtures file (never GitHub),
 * runs it through the classification engine once, and hands back the bare numbers to print.
 */
export async function classifySingleFixture(
  issueId: number,
  fixtures: HarnessFixture[],
  classify: ClassifyFn,
  config: HarnessLlmConfig,
): Promise<SingleFixtureResult> {
  const fixture = findHarnessFixture(fixtures, issueId);
  if (!fixture) {
    throw new Error(`no fixture with id ${issueId}`);
  }

  const result = await classify({ title: fixture.title, content: fixture.body }, config);
  return {
    priority: result.priority,
    effort: result.effortEst,
    et: result.etConsumed,
    timeMs: result.timeInMs,
  };
}

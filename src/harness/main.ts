import { randomUUID } from 'node:crypto';
import { classifyIssue } from '../issue-tracker/llmClassifier.js';
import { harnessConfigName, loadHarnessConfigs, type HarnessLlmConfig } from './harnessConfigs.js';
import { loadHarnessFixtures, type HarnessFixture } from './harnessFixtures.js';
import { runHarness } from './runHarness.js';
import { writeHarnessOutputs } from './harnessReport.js';

const DEFAULT_CONFIGS_PATH = 'configs/harness-default-configs.json';
const DEFAULT_FIXTURES_PATH = 'fixtures/harness-issues.json';

function parseArg(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  return index >= 0 ? argv[index + 1] : undefined;
}

function parseSpecId(argv: string[]): string {
  const specId = parseArg(argv, '--spec-id');
  if (!specId) {
    throw new Error('--spec-id <specId> is required');
  }
  return specId;
}

function filterConfigs(configs: HarnessLlmConfig[], argv: string[]): HarnessLlmConfig[] {
  const wantedName = parseArg(argv, '--config');
  if (!wantedName) return configs;
  const matched = configs.filter((config) => harnessConfigName(config) === wantedName);
  if (matched.length === 0) {
    throw new Error(`--config ${wantedName} matched no entry in the loaded configs`);
  }
  return matched;
}

function filterFixtures(fixtures: HarnessFixture[], argv: string[]): HarnessFixture[] {
  const wantedIds = parseArg(argv, '--fixtures');
  if (!wantedIds) return fixtures;
  const ids = new Set(wantedIds.split(',').map((id) => Number(id.trim())));
  return fixtures.filter((fixture) => ids.has(fixture.id));
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const specId = parseSpecId(argv);
  const generatedDir = process.env.GENERATED_DIR ?? '.generated';

  const configsPath = parseArg(argv, '--configs') ?? DEFAULT_CONFIGS_PATH;
  const allConfigs = await loadHarnessConfigs(configsPath);
  const configs = filterConfigs(allConfigs, argv);

  const allFixtures = await loadHarnessFixtures(DEFAULT_FIXTURES_PATH);
  const fixtures = filterFixtures(allFixtures, argv);

  const entries = await runHarness({ configs, fixtures, classify: classifyIssue });

  const runId = randomUUID();
  await writeHarnessOutputs(generatedDir, specId, runId, entries);

  process.stdout.write(`runId=${runId}\n`);
}

main().catch((error: unknown) => {
  console.error(`harness: ${(error as Error).message}`);
  process.exit(1);
});

import { join } from 'node:path';
import { loadClassifierConfig } from './classifierConfig.js';
import { ClassificationsStore } from './classificationsStore.js';
import { runClassifier } from './classifier.js';
import { classifyIssue } from './llmClassifier.js';
import { loadHarnessFixtures } from '../harness/harnessFixtures.js';
import { classifySingleFixture } from '../harness/singleFixtureClassify.js';

const HARNESS_FIXTURES_PATH = 'fixtures/harness-issues.json';

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

function parseIssueId(argv: string[]): number {
  const raw = parseArg(argv, '--issue-id');
  if (!raw) {
    throw new Error('--issue-id <issueId> is required with --harness');
  }
  return Number(raw);
}

/**
 * --harness classifies a single fixture in isolation: no comment, no jsonl write, no GitHub call.
 * The issue content comes from fixtures/harness-issues.json (the same source the harness grid reads),
 * not from the tracker's GitHub client, so this facade works standalone with no mock server running.
 */
async function runHarnessMode(argv: string[]): Promise<void> {
  const issueId = parseIssueId(argv);
  const config = loadClassifierConfig();
  const fixtures = await loadHarnessFixtures(HARNESS_FIXTURES_PATH);
  const result = await classifySingleFixture(issueId, fixtures, classifyIssue, config.llm);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const specId = parseSpecId(argv);

  if (argv.includes('--harness')) {
    await runHarnessMode(argv);
    return;
  }

  const config = loadClassifierConfig();
  const store = new ClassificationsStore(
    join(config.generatedDir, specId, 'classifications.jsonl'),
  );

  const ok = await runClassifier({
    baseUrl: config.baseUrl,
    specId,
    llmConfig: config.llm,
    store,
    onLine: (line) => process.stdout.write(`${line}\n`),
  });

  process.exit(ok ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(`issue-tracker:classify: ${(error as Error).message}`);
  process.exit(1);
});

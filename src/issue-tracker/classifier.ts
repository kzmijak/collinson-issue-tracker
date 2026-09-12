import { fetchIssues, postComment, type MockIssueSummary } from './mockGithubClient.js';
import { ClassificationsStore } from './classificationsStore.js';
import { hasMarker, parseClassificationFromComment, renderComment } from './classificationComment.js';
import { classifyIssue } from './llmClassifier.js';
import type { Classification } from './classificationTypes.js';
import type { LlmConfig } from './classifierConfig.js';

export const CLASSIFIER_AUTHOR = 'GitHub Issues Classifier';

export type ClassifyOutcome = 'CLASSIFIED' | 'SKIPPED' | 'REPOSTED';

export interface ClassifierDeps {
  baseUrl: string;
  specId: string;
  llmConfig: LlmConfig;
  store: ClassificationsStore;
  onLine?: (line: string) => void;
}

async function processIssue(
  issue: MockIssueSummary,
  deps: ClassifierDeps,
): Promise<ClassifyOutcome> {
  const marker = issue.comments.find((comment) => hasMarker(comment.body, deps.specId, issue.id));

  if (marker) {
    const existing = await deps.store.get(issue.id);
    if (!existing) {
      const recovered = parseClassificationFromComment(marker.body);
      if (recovered) await deps.store.upsert(recovered);
    }
    return 'SKIPPED';
  }

  const cached = await deps.store.get(issue.id);
  if (cached) {
    await postComment(deps.baseUrl, issue.id, renderComment(deps.specId, cached), CLASSIFIER_AUTHOR);
    return 'REPOSTED';
  }

  const result = await classifyIssue({ title: issue.title, content: issue.content }, deps.llmConfig);
  const entry: Classification = {
    issueId: issue.id,
    reply: result.reply,
    priority: result.priority,
    effortEst: result.effortEst,
    meta: {
      timeInMs: result.timeInMs,
      etConsumed: result.etConsumed,
      llmConfig: deps.llmConfig,
    },
  };

  await postComment(deps.baseUrl, issue.id, renderComment(deps.specId, entry), CLASSIFIER_AUTHOR);
  await deps.store.upsert(entry);
  return 'CLASSIFIED';
}

/** One pass over every issue currently visible through the tracker's GitHub client config. */
export async function runClassifier(deps: ClassifierDeps): Promise<boolean> {
  const issues = await fetchIssues(deps.baseUrl);
  let allOk = true;

  for (const issue of issues) {
    try {
      const outcome = await processIssue(issue, deps);
      deps.onLine?.(`${outcome} issueId=${issue.id}`);
    } catch (error) {
      allOk = false;
      deps.onLine?.(`FAILED issueId=${issue.id}: ${(error as Error).message}`);
    }
  }

  return allOk;
}

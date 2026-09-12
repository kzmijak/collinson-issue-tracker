import type { LlmConfig } from './classifierConfig.js';

export interface ClassificationMeta {
  timeInMs: number;
  etConsumed: number;
  llmConfig: LlmConfig;
}

export type IssueKind = 'bug' | 'feature' | 'question' | 'docs' | 'noise';

export interface Classification {
  issueId: number;
  reply: string;
  priority: number;
  effortEst: number;
  kind: IssueKind;
  needsHuman: boolean;
  meta: ClassificationMeta;
}

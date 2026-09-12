import type { LlmConfig } from './classifierConfig.js';

export interface ClassificationMeta {
  timeInMs: number;
  etConsumed: number;
  llmConfig: LlmConfig;
}

export interface Classification {
  issueId: number;
  reply: string;
  priority: number;
  effortEst: number;
  meta: ClassificationMeta;
}

export interface HarnessEntry {
  config: string;
  issueId: number;
  expectedPriority: number;
  expectedEffort: number;
  actualPriority: number;
  actualEffort: number;
  penalty: number;
  arrived: boolean;
  et: number;
  timeMs: number;
  disqualified: boolean;
}

export interface ConfigSummary {
  config: string;
  combinedAccuracy: number;
  priorityAccuracy: number;
  effortAccuracy: number;
  failures: number;
  disqualified: boolean;
  totalEt: number;
  totalTimeMs: number;
}

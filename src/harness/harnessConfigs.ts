import { readFile } from 'node:fs/promises';

export interface HarnessLlmConfig {
  model: string;
  effort: string;
  thinking: boolean;
}

export function harnessConfigName(config: HarnessLlmConfig): string {
  return `${config.model}-${config.effort}-${config.thinking ? 'on' : 'off'}`;
}

export async function loadHarnessConfigs(path: string): Promise<HarnessLlmConfig[]> {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw) as HarnessLlmConfig[];
}

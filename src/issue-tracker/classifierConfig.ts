export interface LlmConfig {
  model: string;
  effort: string;
  thinking: boolean;
}

export interface ClassifierConfig {
  baseUrl: string;
  generatedDir: string;
  llm: LlmConfig;
}

export function loadClassifierConfig(env: NodeJS.ProcessEnv = process.env): ClassifierConfig {
  const port = Number(env.MOCK_GITHUB_PORT ?? 4123);

  return {
    baseUrl: env.MOCK_GITHUB_URL || `http://localhost:${port}`,
    generatedDir: env.GENERATED_DIR ?? '.generated',
    llm: {
      model: env.CLASSIFIER_MODEL ?? 'claude-haiku-4-5',
      effort: env.CLASSIFIER_EFFORT ?? 'low',
      thinking: (env.CLASSIFIER_THINKING ?? 'false').toLowerCase() === 'true',
    },
  };
}

import { consoleLogger, type Logger } from '../cli/consoleLogger.js';
import { FakeGitHub } from '../github/FakeGitHub.js';
import { ConfigError, parseReaderConfig, type ReaderConfig } from './config.js';
import { startReader } from './startReader.js';
import { StatusBar, stdoutWriter } from './statusBar.js';

const STATUS_TICK_MS = 1000;
const CONFIG_FAILURE = 1;

function main(logger: Logger): void {
  let config: ReaderConfig;

  try {
    config = parseReaderConfig(process.env);
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    logger.error(error.message);
    process.exitCode = CONFIG_FAILURE;
    return;
  }

  if (config.apiMode === 'real') {
    logger.error(
      'GITHUB_API_MODE=real is not supported yet — the live GitHub client arrives in a later spec. Use GITHUB_API_MODE=mock.',
    );
    process.exitCode = CONFIG_FAILURE;
    return;
  }

  const reader = startReader({
    github: new FakeGitHub(config.mockFailCount),
    statusBar: new StatusBar(stdoutWriter),
    pollIntervalMs: config.pollIntervalSeconds * 1000,
    statusTickMs: STATUS_TICK_MS,
  });

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      reader.stop();
      process.exit(0);
    });
  }
}

main(consoleLogger);

import { describe, expect, it } from 'vitest';
import { ConfigError, parseReaderConfig } from '../../src/reader/config.js';

const valid = {
  GITHUB_API_MODE: 'mock',
  GITHUB_REPO: 'kzmijak/collinson-issue-tracker',
  POLL_INTERVAL_SECONDS: '1',
};

describe('parseReaderConfig', () => {
  it('accepts a complete environment', () => {
    expect(parseReaderConfig({ ...valid, GITHUB_MOCK_FAIL_COUNT: '2' })).toEqual({
      repo: 'kzmijak/collinson-issue-tracker',
      pollIntervalSeconds: 1,
      apiMode: 'mock',
      mockFailCount: 2,
    });
  });

  it('accepts real as a mode, leaving the unsupported-client refusal to the entrypoint', () => {
    expect(parseReaderConfig({ ...valid, GITHUB_API_MODE: 'real' }).apiMode).toBe('real');
  });

  it('rejects an unset GITHUB_API_MODE rather than defaulting to mock', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_API_MODE: undefined })).toThrow(
      /GITHUB_API_MODE is required — set it to one of: mock, real/,
    );
  });

  it('treats an empty GITHUB_API_MODE as unset', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_API_MODE: '  ' })).toThrow(
      /GITHUB_API_MODE is required/,
    );
  });

  it('rejects an unknown GITHUB_API_MODE', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_API_MODE: 'live' })).toThrow(
      /GITHUB_API_MODE must be one of: mock, real — received 'live'/,
    );
  });

  it('rejects an unset GITHUB_REPO', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_REPO: undefined })).toThrow(
      /GITHUB_REPO is required/,
    );
  });

  it('rejects a GITHUB_REPO with too many segments', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_REPO: 'a/b/c' })).toThrow(
      /GITHUB_REPO must be owner\/repo — received 'a\/b\/c'/,
    );
  });

  it('rejects a GITHUB_REPO with no owner', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_REPO: 'collinson-issue-tracker' })).toThrow(
      /GITHUB_REPO must be owner\/repo/,
    );
  });

  it('rejects an unset POLL_INTERVAL_SECONDS rather than guessing an interval', () => {
    expect(() => parseReaderConfig({ ...valid, POLL_INTERVAL_SECONDS: undefined })).toThrow(
      /POLL_INTERVAL_SECONDS is required/,
    );
  });

  it('rejects a non-numeric POLL_INTERVAL_SECONDS', () => {
    expect(() => parseReaderConfig({ ...valid, POLL_INTERVAL_SECONDS: 'soon' })).toThrow(
      /POLL_INTERVAL_SECONDS must be a positive number — received 'soon'/,
    );
  });

  it('rejects a zero or negative POLL_INTERVAL_SECONDS', () => {
    expect(() => parseReaderConfig({ ...valid, POLL_INTERVAL_SECONDS: '0' })).toThrow(
      /POLL_INTERVAL_SECONDS must be a positive number/,
    );
    expect(() => parseReaderConfig({ ...valid, POLL_INTERVAL_SECONDS: '-5' })).toThrow(
      /POLL_INTERVAL_SECONDS must be a positive number/,
    );
  });

  it('defaults GITHUB_MOCK_FAIL_COUNT to no simulated failures when unset or empty', () => {
    expect(parseReaderConfig(valid).mockFailCount).toBe(0);
    expect(parseReaderConfig({ ...valid, GITHUB_MOCK_FAIL_COUNT: '' }).mockFailCount).toBe(0);
  });

  it('rejects a non-integer or negative GITHUB_MOCK_FAIL_COUNT', () => {
    expect(() => parseReaderConfig({ ...valid, GITHUB_MOCK_FAIL_COUNT: '1.5' })).toThrow(
      /GITHUB_MOCK_FAIL_COUNT must be a non-negative integer — received '1.5'/,
    );
    expect(() => parseReaderConfig({ ...valid, GITHUB_MOCK_FAIL_COUNT: '-1' })).toThrow(
      /GITHUB_MOCK_FAIL_COUNT must be a non-negative integer/,
    );
  });

  it('reports failures as ConfigError so the entrypoint can exit before polling', () => {
    expect(() => parseReaderConfig({})).toThrow(ConfigError);
  });
});

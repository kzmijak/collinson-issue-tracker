import { describe, expect, it } from 'vitest';
import { assertMockMode, loadProactiveConfig } from '../../src/issue-tracker/proactiveConfig.js';

describe('loadProactiveConfig', () => {
  it('falls back to the documented defaults', () => {
    const config = loadProactiveConfig({});

    expect(config.baseUrl).toBe('http://localhost:4001');
    expect(config.pollIntervalMs).toBe(1000);
    expect(config.githubMode).toBe('');
  });

  it('reads every value from the environment when present', () => {
    const config = loadProactiveConfig({
      GITHUB_MODE: 'mock',
      MOCK_GITHUB_PORT: '5555',
      ISSUE_TRACKER_POLL_MS: '250',
    });

    expect(config).toEqual({
      githubMode: 'mock',
      baseUrl: 'http://localhost:5555',
      pollIntervalMs: 250,
    });
  });
});

describe('assertMockMode', () => {
  it('accepts mode "mock"', () => {
    expect(() =>
      assertMockMode({ githubMode: 'mock', baseUrl: '', pollIntervalMs: 1 }),
    ).not.toThrow();
  });

  it('rejects an unset mode', () => {
    expect(() => assertMockMode({ githubMode: '', baseUrl: '', pollIntervalMs: 1 })).toThrow(
      /mock/,
    );
  });

  it('rejects prod mode — out of scope until Beta', () => {
    expect(() => assertMockMode({ githubMode: 'prod', baseUrl: '', pollIntervalMs: 1 })).toThrow(
      /mock/,
    );
  });
});

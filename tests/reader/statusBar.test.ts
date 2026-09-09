import { describe, expect, it } from 'vitest';
import { FakeStatusBarWriter, StatusBar } from '../../src/reader/statusBar.js';

function bar(): { statusBar: StatusBar; writer: FakeStatusBarWriter } {
  const writer = new FakeStatusBarWriter();
  return { statusBar: new StatusBar(writer), writer };
}

describe('StatusBar', () => {
  it('renders its first frame on a line of its own, preceded by one blank line', () => {
    const { statusBar, writer } = bar();

    statusBar.show();

    expect(writer.stream).toBe('\nPolling .');
    expect(writer.lines).toEqual(['', 'Polling .']);
  });

  it('cycles . -> .. -> ... -> . in place, never opening a new line', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    const before = writer.chunks.length;
    for (let index = 0; index < 3; index += 1) statusBar.tick();

    const redraws = writer.chunks.slice(before).join('');
    expect(redraws).not.toContain('\n');
    expect(
      redraws
        .split('\r')
        .map((part) => part.trim())
        .filter(Boolean),
    ).toEqual(['Polling ..', 'Polling ...', 'Polling .']);
  });

  it('erases the previous frame so a shorter one leaves no trailing characters', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.setError('boom');
    const before = writer.chunks.length;
    statusBar.clearError();

    expect(writer.chunks.slice(before).join('')).toBe(
      `\r${' '.repeat('Polling . Error: boom'.length)}\rPolling .`,
    );
  });

  it('logs a line above the bar and redraws the bar underneath it', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.log('#1 Fix login bug');

    expect(writer.lines.at(-3)).toBe('');
    expect(writer.lines.at(-2)).toContain('#1 Fix login bug');
    expect(writer.lines.at(-1)).toBe('\r\rPolling .');
  });

  it('carries the error inline on the bar and drops it once cleared', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.setError('request failed');
    expect(writer.stream).toContain('Polling . Error: request failed');

    statusBar.clearError();
    expect(writer.stream.endsWith('Polling .')).toBe(true);
  });

  it('keeps the error while the dots keep ticking', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.setError('request failed');
    statusBar.tick();

    expect(writer.stream.endsWith('Polling .. Error: request failed')).toBe(true);
  });

  it('writes nothing when asked to clear an error it never had', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    const before = writer.chunks.length;
    statusBar.clearError();

    expect(writer.chunks).toHaveLength(before);
  });

  it('collapses whitespace in an error message so the bar stays on one line', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.setError('  socket hang up\nHTTP 502\r\n');

    expect(writer.stream).toContain('Polling . Error: socket hang up HTTP 502');
    expect(writer.lines).toHaveLength(2);
  });

  it('never emits the superseded Loading wording', () => {
    const { statusBar, writer } = bar();

    statusBar.show();
    statusBar.tick();
    statusBar.setError('nope');
    statusBar.log('#3 Add dark mode');

    expect(writer.stream).not.toContain('Loading');
  });
});

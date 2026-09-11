const ESC = '[';
const CURSOR_UP_ONE = `${ESC}1A`;
const CLEAR_DOWN = `${ESC}0J`;
const CLEAR_LINE = `\r${ESC}2K`;

const DOT_FRAMES = ['.', '..', '...'];
const DOT_TICK_MS = 500;

export type Write = (chunk: string) => void;

/**
 * Owns the whole visible output: an append-only, never-rewritten block of issue lines, one blank
 * line printed once, then an in-place status row glued to the bottom.
 *
 * The status row is always the "current" row (writes to it use \r, never \n), so inserting new
 * issue lines above it is: move up onto the blank line's row, erase both it and the status row,
 * print the new issue lines, then reprint the blank line and the status row fresh.
 */
export class TerminalRenderer {
  private readonly write: Write;
  private dotPhase = 0;
  private errorText: string | null = null;
  private tickTimer: NodeJS.Timeout | null = null;

  constructor(write: Write = (chunk) => process.stdout.write(chunk)) {
    this.write = write;
  }

  /** Prints the blank separator once and starts the "Polling ." status row cycling. */
  start(): void {
    this.write('\n');
    this.renderStatus();
    this.tickTimer = setInterval(() => {
      this.dotPhase = (this.dotPhase + 1) % DOT_FRAMES.length;
      this.renderStatus();
    }, DOT_TICK_MS);
    this.tickTimer.unref?.();
  }

  stop(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }

  /** Appends issue lines above the blank line + status row, never touching earlier lines. */
  printIssueLines(lines: string[]): void {
    if (lines.length === 0) return;
    // The leading \n terminates whatever status fragment was mid-write (no trailing newline of
    // its own) so it never shares a raw output line with the issue text below; CURSOR_UP_ONE
    // cancels that newline's visual line advance, so a live terminal sees no difference.
    this.write('\n' + CURSOR_UP_ONE + '\r' + CLEAR_DOWN);
    for (const line of lines) this.write(`${line}\n`);
    this.write('\n');
    this.renderStatus();
  }

  /** Stays appended to the Polling line until the next successful poll calls clearError(). */
  setError(message: string): void {
    this.errorText = message;
    this.renderStatus();
  }

  clearError(): void {
    if (this.errorText === null) return;
    this.errorText = null;
    this.renderStatus();
  }

  private renderStatus(): void {
    const dots = DOT_FRAMES[this.dotPhase];
    const suffix = this.errorText ? ` ${this.errorText}` : '';
    this.write(`${CLEAR_LINE}Polling ${dots}${suffix}`);
  }
}

export function formatIssueLine(issue: { number: number; title: string }): string {
  return `#${issue.number} ${issue.title}`;
}

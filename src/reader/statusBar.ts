const DOT_PHASES = ['.', '..', '...'] as const;

export interface StatusBarWriter {
  write: (chunk: string) => void;
}

export const stdoutWriter: StatusBarWriter = {
  write: (chunk) => {
    process.stdout.write(chunk);
  },
};

export class FakeStatusBarWriter implements StatusBarWriter {
  readonly chunks: string[] = [];

  write(chunk: string): void {
    this.chunks.push(chunk);
  }

  get stream(): string {
    return this.chunks.join('');
  }

  get lines(): string[] {
    return this.stream.split('\n');
  }
}

export class StatusBar {
  private phase = 0;
  private error: string | undefined;
  private renderedWidth = 0;
  private rendered = false;

  constructor(private readonly writer: StatusBarWriter) {}

  show(): void {
    this.render();
  }

  tick(): void {
    this.phase = (this.phase + 1) % DOT_PHASES.length;
    this.render();
  }

  log(line: string): void {
    this.writer.write(`${this.eraseFrame()}${line}\n`);
    this.renderedWidth = 0;
    this.render();
  }

  setError(message: string): void {
    this.error = collapseWhitespace(message);
    this.render();
  }

  clearError(): void {
    if (this.error === undefined) return;
    this.error = undefined;
    this.render();
  }

  private render(): void {
    const frame = this.frame();
    this.writer.write(this.rendered ? `${this.eraseFrame()}${frame}` : `\n${frame}`);
    this.rendered = true;
    this.renderedWidth = frame.length;
  }

  private frame(): string {
    const polling = `Polling ${DOT_PHASES[this.phase]}`;
    return this.error === undefined ? polling : `${polling} Error: ${this.error}`;
  }

  private eraseFrame(): string {
    return `\r${' '.repeat(this.renderedWidth)}\r`;
  }
}

/** A newline in a provider's error message would tear the bar off its single line. */
function collapseWhitespace(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

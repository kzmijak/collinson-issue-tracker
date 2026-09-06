import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

export class Chronicle<TEvent extends ChronicleEvent = ChronicleEvent> {
  private constructor(
    private readonly filePath: string | null,
    private readonly events: TEvent[] = [],
  ) {}

  static wrap<TEvent extends ChronicleEvent>(events: TEvent[] = []): Chronicle<TEvent> {
    return new Chronicle<TEvent>(null, events);
  }

  static async synchronized<TEvent extends ChronicleEvent>(
    filePath: string,
    prologue: TEvent,
  ): Promise<Chronicle<TEvent>> {
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, '');
    const chronicle = new Chronicle<TEvent>(filePath);
    await chronicle.write(prologue);
    return chronicle;
  }

  static async load<TEvent extends ChronicleEvent>(filePath: string): Promise<Chronicle<TEvent>> {
    const content = await readFile(filePath, 'utf-8').catch(() => '');
    const events = content
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l) as TEvent);
    return new Chronicle<TEvent>(filePath, events);
  }

  async write(...events: TEvent[]) {
    for (const e of events) {
      this.events.push(e);
      if (this.filePath) {
        await appendFile(this.filePath, JSON.stringify(e) + '\n');
      }
    }
  }

  readAfterLast(predicateFn: (event: TEvent) => boolean): TEvent[] {
    const reverseArray = [...this.events].reverse();
    const breakpointItem = reverseArray.find(predicateFn);

    if (!breakpointItem) return [...this.events];

    return this.events.slice(this.events.indexOf(breakpointItem) + 1);
  }

  readAll(): TEvent[] {
    return [...this.events];
  }

  get length(): number {
    return this.events.length;
  }
}

export type ChronicleEvent<TType extends string = string> = {
  type: TType;
};

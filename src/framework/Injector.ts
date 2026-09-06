import type { Chronicle, ChronicleEvent } from '../llm/Chronicle.js';

export abstract class Injector<TEvent extends ChronicleEvent> {
  abstract readonly id: string;

  protected abstract deduplicator(lastEvent: TEvent): boolean;
  protected abstract check(fresh: TEvent[], full: TEvent[]): TEvent | null;

  evaluate(chronicle: Chronicle<TEvent>): TEvent | null {
    const full = chronicle.readAll();
    const last = full.at(-1);

    if (last && this.deduplicator(last)) return null;

    const fresh = chronicle.readAfterLast((e) => this.deduplicator(e));
    return this.check(fresh, full);
  }
}

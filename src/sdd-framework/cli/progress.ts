import type { Activity } from '../llm/Llm.js';
import { consoleLogger } from './consoleLogger.js';
import { CLEAR_LINE, duration, effectiveTokens, fitLine, style } from './format.js';

export interface Progress {
  activity: (activity: Activity) => void;
  /** Leaves one line behind — what happened, how long it took, what it cost — instead of vanishing. */
  stop: (outcome?: string) => void;
}

/** Finished calls count exactly; the one still running adds its running figure on top. */
export class UsageTally {
  private settled = 0;
  private running = 0;
  private estimated = false;

  add(activity: Activity): void {
    if (activity.kind !== 'usage') return;

    if (activity.final) {
      this.settled += activity.effectiveTokens;
      this.running = 0;
      this.estimated = false;
      return;
    }
    this.running = activity.effectiveTokens;
    this.estimated = activity.estimated;
  }

  get total(): number {
    return this.settled + this.running;
  }

  describe(): string {
    return effectiveTokens(this.total, this.estimated);
  }
}

export function startProgress(label: string): Progress {
  const startedAt = Date.now();
  const tty = process.stderr.isTTY;
  const tally = new UsageTally();
  const frames = ['.  ', '.. ', '...'];
  let frame = 0;
  let drawn = false;

  const draw = (): void => {
    const tail = `${frames[frame++ % frames.length]} ${duration(Date.now() - startedAt)} · ${tally.describe()}`;
    process.stderr.write(`${CLEAR_LINE}${fitLine(label, tail, process.stderr.columns ?? 80)}`);
    drawn = true;
  };

  const timer = tty ? setInterval(draw, 400) : null;

  return {
    activity: (activity) => tally.add(activity),
    stop: (outcome) => {
      if (timer) clearInterval(timer);
      if (drawn) process.stderr.write(CLEAR_LINE);

      const parts = [outcome, duration(Date.now() - startedAt)];
      if (tally.total > 0) parts.push(tally.describe());
      consoleLogger.info(`${style('•', 'dim')} ${label} — ${parts.filter(Boolean).join(' · ')}`);
    },
  };
}

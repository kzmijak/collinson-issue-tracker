import type { Llm } from '../llm/Llm.js';
import { enrich, type EnrichContext, type EnrichResult } from './enrich.js';
import { enrichAccs, type EnrichAccsResult } from './enrichAccs.js';
import { readLastVerification } from './metrics.js';
import { readStatus } from './SpecFile.js';
import { isStale, readSpecFolder } from './specFolder.js';
import { verify, type VerifyResult } from './verify.js';

export type LoopStepKind = 'enrich' | 'fix-accs' | 'verify';

export type LoopStep =
  | { turn: number; kind: 'enrich'; result: EnrichResult }
  | { turn: number; kind: 'fix-accs'; result: EnrichAccsResult }
  | { turn: number; kind: 'verify'; result: VerifyResult };

export interface LoopAgents {
  enricher: Llm;
  accsAuthor: Llm;
  verifier: Llm;
}

export interface VerifyLoopProps {
  maxTurns: number;
  enrich: EnrichContext;
  /** Re-verifies on the first turn even when a verdict for this exact spec is on record. */
  force?: boolean;
  /** Wraps each step, so a caller can show progress around it without the loop knowing how. */
  around?: <TResult>(
    turn: number,
    kind: LoopStepKind,
    work: () => Promise<TResult>,
  ) => Promise<TResult>;
  onStep?: (step: LoopStep) => void;
}

export interface VerifyLoopResult {
  status: 'approved' | 'blocked' | 'exhausted';
  turns: number;
  effectiveTokens: number;
}

/**
 * A turn is one verify, preceded by whatever the spec needs first. A spec the operator changed, or
 * one the verifier sent back for its spec, is enriched again — enriched spec and ACCS together. One
 * sent back for its ACCS alone gets only the ACCS repaired, so an approved contract is not rewritten
 * over a bug in the script. The verifier makes that call; the loop only follows it.
 */
export async function verifyLoop(
  path: string,
  agents: LoopAgents,
  props: VerifyLoopProps,
): Promise<VerifyLoopResult> {
  const around = props.around ?? ((_turn, _kind, work) => work());
  const enrichWith = { enricher: agents.enricher, accsAuthor: agents.accsAuthor };
  let effectiveTokens = 0;

  const runEnrich = async (turn: number): Promise<EnrichResult> => {
    const result = await around(turn, 'enrich', () =>
      enrich(path, enrichWith, 'default', props.enrich),
    );
    if (result.status !== 'unchanged') effectiveTokens += result.effectiveTokens;
    props.onStep?.({ turn, kind: 'enrich', result });
    return result;
  };

  for (let turn = 1; turn <= props.maxTurns; turn += 1) {
    const folder = await readSpecFolder(path);
    const rejected = readStatus(folder.enriched) === 'rejected';

    if (isStale(folder)) {
      if ((await runEnrich(turn)).status === 'blocked') return blocked(turn);
    } else if (rejected) {
      const fix = (await readLastVerification(folder.paths.output))?.fix ?? 'spec';

      if (fix === 'accs') {
        const result = await around(turn, 'fix-accs', () =>
          enrichAccs(path, agents.accsAuthor, props.enrich),
        );
        effectiveTokens += result.effectiveTokens;
        props.onStep?.({ turn, kind: 'fix-accs', result });

        // Nothing to repair on record means the verdict gave the script nothing to go on.
        if (result.status !== 'written' && (await runEnrich(turn)).status === 'blocked') {
          return blocked(turn);
        }
      } else if ((await runEnrich(turn)).status === 'blocked') {
        return blocked(turn);
      }
    }

    const force = turn === 1 && Boolean(props.force);
    const result = await around(turn, 'verify', () => verify(path, agents.verifier, force));
    effectiveTokens += result.effectiveTokens;
    props.onStep?.({ turn, kind: 'verify', result });

    if (result.verdict === 'approved') return { status: 'approved', turns: turn, effectiveTokens };
  }

  return { status: 'exhausted', turns: props.maxTurns, effectiveTokens };

  function blocked(turn: number): VerifyLoopResult {
    return { status: 'blocked', turns: turn, effectiveTokens };
  }
}

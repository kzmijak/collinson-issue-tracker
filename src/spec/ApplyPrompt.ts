import { z } from 'zod';
import { JsonPrompt } from '../llm/JsonPrompt.js';
import { ModelContractError } from './EnrichPrompt.js';
import { excerpt, type CheckResult } from './runCheck.js';

const pickSchema = z.object({
  decision: z.string().min(1),
  chose: z.string().min(1),
  why: z.string().min(1),
});

export type ImplementationPick = z.infer<typeof pickSchema>;

export const implementationSchema = z.object({
  summary: z.string().min(1),
  files: z.array(z.string()),
  picks: z.array(pickSchema),
  blocked: z.string().nullable(),
  /** The single thing the operator has to do. Null unless blocked. */
  remedy: z.string().nullable(),
});

export type Implementation = z.infer<typeof implementationSchema>;

export interface ApplyContext {
  /** The whole spec file, both halves, verbatim. */
  spec: string;
  /** Every other file in the spec's directory, the acceptance check among them. */
  artefacts: string;
  knowledge: string;
  /** The implementer's identity, read from its agent definition. */
  instructions: string;
  script: string;
}

const OUTPUT_CONTRACT = [
  '## How to answer',
  '',
  'This is read in a terminal, by someone doing three other things. A long answer buries the one',
  'line that matters, so length is not thoroughness here — it is the opposite.',
  '',
  'Talk like a colleague at the next desk. Do not restate the specification back. Do not list what',
  'you ruled out, do not narrate your own process, and do not explain a decision twice because it',
  'appears in two fields. If you refused a workaround, one clause is enough.',
  '',
  'Return one JSON object and nothing else:',
  '',
  '{ "summary": "...", "files": ["..."], "picks": [{ "decision": "...", "chose": "...",',
  '  "why": "..." }], "blocked": null, "remedy": null }',
  '',
  '- "summary" — **at most three sentences.** What you built, and whether it works. Not how you',
  '  decided, not what you considered.',
  '- "files" — every file you created or changed, repo-relative. Complete: it is the record of what',
  '  moved, and a missing entry means a change nobody knows about.',
  '- "picks" — one entry for every choice the specification left open. "decision" is the question',
  '  in under twelve words. "chose" is what you did, one line. "why" is **one sentence.**',
  '  An empty list claims the spec decided everything, so only send one if that is true.',
  '- "blocked" — null when you are done. Otherwise **at most three sentences** naming what',
  '  conflicts with what, with the evidence inside one of them.',
  '- "remedy" — null unless blocked. Otherwise the single thing the operator has to do, as one',
  '  line. If it is a command, write the command and nothing else.',
].join('\n');

abstract class ImplementationPrompt extends JsonPrompt<Implementation> {
  protected outputParser(output: object): Implementation {
    const parsed = implementationSchema.safeParse(output);

    if (!parsed.success) {
      throw new ModelContractError(
        `the implementer did not return the agreed JSON shape: ${parsed.error.issues
          .map((issue) => issue.path.join('.') || '(root)')
          .join(', ')}. The working tree may still have been changed — check \`git status\`.`,
      );
    }
    return parsed.data;
  }
}

/**
 * The first round. Everything the implementer is allowed to know arrives here: the specification,
 * the files it generated, the knowledge base and its own identity. Nothing about this project is
 * restated in this file — whatever is missing from those four is missing from the implementation,
 * and that is the point. A gap papered over by the wording of a prompt is a gap nobody can see,
 * because the prompt is not committed and the spec is.
 */
export class ApplyPrompt extends ImplementationPrompt {
  constructor(private readonly context: ApplyContext) {
    super();
  }

  createMessage(): string {
    return [
      this.context.instructions,
      '',
      '## The specification',
      '',
      this.context.spec,
      '',
      '## The files this specification generated',
      '',
      this.context.artefacts || '(none)',
      '',
      '## Knowledge base',
      '',
      this.context.knowledge || '(empty — nothing has been added to it yet)',
      '',
      '## Your task',
      '',
      'Implement this specification in the repository you are working in. Its acceptance check is:',
      '',
      `    bash ${this.context.script}`,
      '',
      'Run it whenever you want. You are done when it exits 0.',
      '',
      'Everything that was decided about what to build is above. If something is not there, it was',
      'not decided — handle it the way you were told to handle an undecided choice, and record it.',
      '',
      OUTPUT_CONTRACT,
    ].join('\n');
  }
}

const OUTPUT_EXCERPT_LIMIT = 6_000;

/**
 * A later round, sent into the same session, so the spec and the identity are not paid for twice.
 * It carries only what changed: what the check said.
 */
export class ReapplyPrompt extends ImplementationPrompt {
  constructor(
    private readonly check: CheckResult,
    private readonly round: number,
    private readonly rounds: number,
  ) {
    super();
  }

  createMessage(): string {
    return [
      `The acceptance check still fails. This is round ${this.round} of ${this.rounds}; when the`,
      'last one is spent the run stops wherever it stands.',
      '',
      '```',
      excerpt(this.check.output.trim(), OUTPUT_EXCERPT_LIMIT),
      '```',
      '',
      `The check exited ${this.check.exitCode}.`,
      '',
      'Fix your code and run it again. Never change the check and never change the specification to',
      'match what you built. If the check cannot pass as written, set "blocked" and name the',
      'conflict instead of working around it.',
      '',
      'Answer in the same JSON shape as before, under the same limits: three sentences of summary,',
      'one sentence per reason.',
    ].join('\n');
  }
}

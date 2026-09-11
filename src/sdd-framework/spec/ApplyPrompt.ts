import { JsonPrompt } from '../llm/JsonPrompt.js';
import { schemaToSpec } from '../llm/schemaToSpec.js';
import { implementationSchema, type Implementation } from './schemas/Implementation.js';
import { ModelContractError } from './EnrichPrompt.js';
import { excerpt, type CheckResult } from './runCheck.js';

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

abstract class ImplementationPrompt extends JsonPrompt<Implementation> {
  static outputSpecification = schemaToSpec(implementationSchema);

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
      'Fix your code and run it again. Answer in the same JSON shape.',
    ].join('\n');
  }
}

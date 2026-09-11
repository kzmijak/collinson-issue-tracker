import { readFileSync } from 'node:fs';

export const PROJECT_CONTEXT = '.ai/context.md';

export interface AgentPromptProps {
  /** Headings to drop, with everything under them until the next heading of the same level. */
  without?: string[];
}

export function readAgentPrompt(path: string, props: AgentPromptProps = {}): string {
  const source = readFileSync(path, 'utf8');
  const withoutFrontmatter = source.startsWith('---')
    ? source.slice(source.indexOf('\n---', 3) + 4)
    : source;

  return (props.without ?? [])
    .reduce((text, heading) => dropSection(text, heading), withoutFrontmatter)
    .trim();
}

/**
 * An agent definition written for a subagent can carry an output format that contradicts the one a
 * caller needs. Dropping the section is better than duplicating the file: the character stays in
 * one place, only the shape of the answer changes.
 */
function dropSection(text: string, heading: string): string {
  const lines = text.split('\n');
  const target = new RegExp(`^##\\s+${heading}\\s*$`);
  let fenced = false;
  let from = -1;
  let to = lines.length;

  for (const [index, line] of lines.entries()) {
    if (line.trimStart().startsWith('```')) fenced = !fenced;
    if (fenced) continue;

    if (from < 0 && target.test(line)) {
      from = index;
      continue;
    }
    if (from >= 0 && /^##\s+/.test(line)) {
      to = index;
      break;
    }
  }
  return from < 0 ? text : [...lines.slice(0, from), ...lines.slice(to)].join('\n');
}

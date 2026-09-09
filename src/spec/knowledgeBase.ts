import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const KNOWLEDGE_DIR = 'knowledge';

const FILE_LIMIT = 20_000;

/**
 * The third thing an implementer is given, alongside the specification and its own identity.
 * Empty until someone puts a document here: the directory being absent is the normal state, not a
 * fault, so there is nothing to configure before the first document exists.
 */
export async function readKnowledgeBase(dir = KNOWLEDGE_DIR): Promise<string> {
  const names = await readdir(dir).catch(() => [] as string[]);
  const parts: string[] = [];

  for (const name of names.sort()) {
    if (!name.endsWith('.md')) continue;

    const content = await readFile(join(dir, name), 'utf8').catch(() => '');
    if (!content.trim()) continue;

    parts.push(`### ${name}\n\n${cap(content)}`);
  }
  return parts.join('\n\n');
}

function cap(content: string): string {
  return content.length > FILE_LIMIT ? `${content.slice(0, FILE_LIMIT)}\n… truncated …` : content;
}

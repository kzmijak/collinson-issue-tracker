import { z } from 'zod';

/** Marks where a comment starts, so a separating comma can go before it rather than inside it. */
const COMMENT = ' \u0001// ';

export function schemaToSpec(schema: z.ZodObject<z.ZodRawShape>): string {
  const task = schema.description ? `${schema.description}\n\n` : '';
  const body = serializeValue(schema, 0).replaceAll(COMMENT, ' // ');
  return `${task}Respond in raw JSON only, no markdown fences:\n${body}`;
}

function withComma(entry: string): string {
  const lines = entry.split('\n');
  const last = lines.length - 1;
  const at = lines[last].indexOf(COMMENT);
  lines[last] = at < 0 ? `${lines[last]},` : `${lines[last].slice(0, at)},${lines[last].slice(at)}`;
  return lines.join('\n');
}

function serializeValue(schema: z.ZodTypeAny, depth: number): string {
  const pad = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);

  if (schema instanceof z.ZodString) {
    const desc = schema.description?.replaceAll('"', "'");
    return desc ? `"<${desc}>"` : '""';
  }
  if (schema instanceof z.ZodNumber) {
    return schema.description ? `0${COMMENT}${schema.description}` : '0';
  }
  if (schema instanceof z.ZodBoolean) {
    return schema.description ? `false${COMMENT}${schema.description}` : 'false';
  }
  if (schema instanceof z.ZodEnum) {
    const options = (schema as z.ZodEnum<[string, ...string[]]>).options.join(' | ');
    return `"<${options}>"`;
  }
  if (schema instanceof z.ZodArray) {
    const note = schema.description ? `${COMMENT}${schema.description}` : '';
    const item = serializeValue(schema.element, depth + 1);
    if (schema.element instanceof z.ZodString) {
      return `["<${schema.element.description ?? 'string'}>"]${note}`;
    }
    if (item.startsWith('{')) {
      return `[${note}\n${inner}${item}\n${pad}]`;
    }
    return `[${item}]${note}`;
  }
  if (schema instanceof z.ZodNullable) {
    const inner = schema.unwrap() as z.ZodTypeAny;
    const own = schema.description !== inner.description ? schema.description : undefined;
    return `${serializeValue(inner, depth)}${COMMENT}${own ?? 'or null'}`;
  }
  if (schema instanceof z.ZodUnion) {
    return serializeValue((schema.options as z.ZodTypeAny[])[0], depth);
  }
  if (schema instanceof z.ZodOptional) {
    return serializeValue(schema.unwrap(), depth) + `${COMMENT}optional`;
  }
  if (schema instanceof z.ZodDefault) {
    return serializeValue(schema.removeDefault(), depth);
  }
  if (schema instanceof z.ZodEffects) {
    return serializeValue(schema.innerType(), depth);
  }
  if (schema instanceof z.ZodRecord) {
    const note = schema.description ? `${COMMENT}${schema.description}` : '';
    return `{}${note}`;
  }
  if (schema instanceof z.ZodUnknown) {
    return schema.description ? `null${COMMENT}${schema.description}` : 'null';
  }
  if (schema instanceof z.ZodObject) {
    const entries = Object.entries(schema.shape as Record<string, z.ZodTypeAny>).map(
      ([key, val]) => `${inner}"${key}": ${serializeValue(val, depth + 1)}`,
    );
    const separated = entries.map((entry, index) =>
      index < entries.length - 1 ? withComma(entry) : entry,
    );
    return `{\n${separated.join('\n')}\n${pad}}`;
  }
  throw new Error(`schemaToSpec: unhandled Zod type ${schema.constructor.name}`);
}

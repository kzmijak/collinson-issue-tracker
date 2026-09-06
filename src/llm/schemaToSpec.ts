import { z } from 'zod';

export function schemaToSpec(schema: z.ZodObject<z.ZodRawShape>): string {
  const task = schema.description ? `${schema.description}\n\n` : '';
  return `${task}Respond in raw JSON only, no markdown fences:\n${serializeValue(schema, 0)}`;
}

function serializeValue(schema: z.ZodTypeAny, depth: number): string {
  const pad = '  '.repeat(depth);
  const inner = '  '.repeat(depth + 1);

  if (schema instanceof z.ZodString) {
    const desc = schema.description?.replaceAll('"', "'");
    return desc ? `"<${desc}>"` : '""';
  }
  if (schema instanceof z.ZodNumber) {
    return schema.description ? `0 // ${schema.description}` : '0';
  }
  if (schema instanceof z.ZodBoolean) {
    return schema.description ? `false // ${schema.description}` : 'false';
  }
  if (schema instanceof z.ZodEnum) {
    const options = (schema as z.ZodEnum<[string, ...string[]]>).options.join(' | ');
    return `"<${options}>"`;
  }
  if (schema instanceof z.ZodArray) {
    const note = schema.description ? ` // ${schema.description}` : '';
    const item = serializeValue(schema.element, depth + 1);
    if (schema.element instanceof z.ZodString) {
      return `["<${schema.element.description ?? 'string'}>"]${note}`;
    }
    if (item.startsWith('{')) {
      return `[${note}\n${inner}${item}\n${pad}]`;
    }
    return `[${item}]${note}`;
  }
  if (schema instanceof z.ZodOptional) {
    return serializeValue(schema.unwrap(), depth) + ' // optional';
  }
  if (schema instanceof z.ZodDefault) {
    return serializeValue(schema.removeDefault(), depth);
  }
  if (schema instanceof z.ZodEffects) {
    return serializeValue(schema.innerType(), depth);
  }
  if (schema instanceof z.ZodRecord) {
    const note = schema.description ? ` // ${schema.description}` : '';
    return `{}${note}`;
  }
  if (schema instanceof z.ZodUnknown) {
    return schema.description ? `null // ${schema.description}` : 'null';
  }
  if (schema instanceof z.ZodObject) {
    const entries = Object.entries(schema.shape as Record<string, z.ZodTypeAny>).map(
      ([key, val]) => `${inner}"${key}": ${serializeValue(val, depth + 1)}`,
    );
    return `{\n${entries.join(',\n')}\n${pad}}`;
  }
  throw new Error(`schemaToSpec: unhandled Zod type ${schema.constructor.name}`);
}

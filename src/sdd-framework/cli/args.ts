/**
 * A spec is named by a bare number as often as by a slug, so a flag's own value must not be
 * mistaken for it: `pnpm apply --rounds 3` would otherwise try to apply spec 3.
 */
export function positional(args: string[], valueFlags: string[] = []): string | undefined {
  const valueIndexes = new Set(
    valueFlags.map((flag) => args.indexOf(flag)).filter((index) => index >= 0),
  );

  return args.find((arg, index) => !arg.startsWith('--') && !valueIndexes.has(index - 1));
}

export function numberFlag(args: string[], name: string): number | null {
  const index = args.indexOf(name);
  if (index < 0) return null;

  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : null;
}

import type { Classification } from './classificationTypes.js';

export function markerFor(specId: string, issueId: number): string {
  return `<!-- classifier:${specId}:${issueId} -->`;
}

function dataMarkerFor(entry: Classification): string {
  return `<!-- classifier-data:${JSON.stringify(entry)} -->`;
}

/**
 * The marker is the sole detection signal per the enriched spec's contract. The data marker is an
 * internal add-on so a comment surviving a lost jsonl file can be backfilled without guesswork.
 */
export function renderComment(specId: string, entry: Classification): string {
  return [
    markerFor(specId, entry.issueId),
    dataMarkerFor(entry),
    entry.reply,
    '',
    '| Field | Value |',
    '| --- | --- |',
    `| Priority | ${entry.priority} |`,
    `| Estimated effort | ${entry.effortEst} |`,
  ].join('\n');
}

export function hasMarker(body: string, specId: string, issueId: number): boolean {
  return body.startsWith(markerFor(specId, issueId));
}

/** Recovers a full classification from a marker comment when the jsonl entry has gone missing. */
export function parseClassificationFromComment(body: string): Classification | undefined {
  const match = /^<!-- classifier-data:(.+) -->$/m.exec(body);
  if (!match) return undefined;
  try {
    return JSON.parse(match[1]) as Classification;
  } catch {
    return undefined;
  }
}

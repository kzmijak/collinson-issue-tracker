#!/usr/bin/env node
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cmd = input.tool_input?.command || '';

  if (/(^|[;&|]\s*)git\s+(commit|add)\b/.test(cmd)) {
    return block('Delegate commits to the operator. Do not commit from a tool call.');
  }

  const guarded = '(?:src|tests|fixtures)/';
  const writers = [
    new RegExp(`>>?\\s*['"]?\\.?/?${guarded}`),
    new RegExp(`\\b(?:tee|dd\\s+of=)\\s+(?:-a\\s+)?['"]?\\.?/?${guarded}`),
    new RegExp(`\\bsed\\s+[^|]*-i\\b[^|]*${guarded}`),
    new RegExp(`\\b(?:cp|mv|install)\\s+[^|]*\\s['"]?\\.?/?${guarded}`),
    new RegExp(`\\b(?:python3?|node|tsx)\\b[^|]*\\bopen\\(['"]\\.?/?${guarded}`),
  ];

  if (writers.some((re) => re.test(cmd))) {
    return block(
      'STOP: Code Production Protocol. src/, tests/ and fixtures/ are not written from tool calls. ' +
        'Code is emitted in chat as an accepted artifact, and transcribed only on an explicit ' +
        'instruction naming the path. See CLAUDE.md.',
    );
  }
});

function block(reason) {
  console.log(JSON.stringify({ decision: 'block', reason }));
}

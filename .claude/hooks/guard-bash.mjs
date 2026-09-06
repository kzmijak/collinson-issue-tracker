#!/usr/bin/env node
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());
  const cmd = input.tool_input?.command || '';

  if (/(^|[;&|]\s*)git\s+(commit|add)\b/.test(cmd)) {
    console.log(
      JSON.stringify({
        decision: 'block',
        reason:
          "STOP: commits are the operator's call, not an automated step at the end of a task. " +
          'Report that changes are in the working tree and wait to be asked.',
      }),
    );
  }
});

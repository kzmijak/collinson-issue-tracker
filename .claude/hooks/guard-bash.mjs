#!/usr/bin/env node
const chunks = [];
process.stdin.on('data', (c) => chunks.push(c));
process.stdin.on('end', () => {
  const input = JSON.parse(Buffer.concat(chunks).toString());

  // The git agent is the only committer. Everything else, the main session included,
  // prepares the working tree and delegates.
  if (input.agent_type === 'git') return;

  const cmd = input.tool_input?.command || '';

  if (/(^|[;&|]\s*)git\s+(commit|add)\b/.test(cmd)) {
    console.log(
      JSON.stringify({
        decision: 'block',
        reason:
          'STOP: delegate commits to the git agent. You are the orchestrator, not the committer. ' +
          'Report that changes are in the working tree and wait to be asked.',
      }),
    );
  }
});

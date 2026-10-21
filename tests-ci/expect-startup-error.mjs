// Checks that an invalid configuration stops the generated server with a message, without a stack trace.
// Usage (from the generated project folder, after `npm run server:build`):
//   node expect-startup-error.mjs <expected message> [VARIABLE=value ...]
// Written in Node rather than bash so it depends neither on `timeout` (missing on macOS) nor on bash 4.
import { spawnSync } from 'node:child_process';

const [message, ...assignments] = process.argv.slice(2);
const env = { ...process.env };
for (const assignment of assignments) {
  const separator = assignment.indexOf('=');
  env[assignment.slice(0, separator)] = assignment.slice(separator + 1);
}

// The timeout keeps a server that starts by mistake from blocking the CI.
const { status, stdout, stderr } = spawnSync(process.execPath, ['dist/server/main.js'], {
  env,
  encoding: 'utf8',
  timeout: 10_000,
});
const output = `${stdout}${stderr}`;
const description = assignments.join(' ');

if (status === 0 || status === null) {
  console.error(`The server should have refused to start (${description}). Output:\n${output}`);
  process.exit(1);
}
if (!output.includes(message) || /^\s+at /m.test(output)) {
  console.error(`Expected: the message "${message}" without a stack trace (${description}). Got:\n${output}`);
  process.exit(1);
}

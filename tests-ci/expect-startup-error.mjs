// Vérifie qu'une configuration invalide arrête le serveur généré avec un message, sans stack trace.
// Usage (depuis le dossier du projet généré, après `npm run server:build`) :
//   node expect-startup-error.mjs <message attendu> [VARIABLE=valeur ...]
// Écrit en Node plutôt qu'en bash pour ne pas dépendre de `timeout` (absent de macOS) ni de bash 4.
import { spawnSync } from 'node:child_process';

const [message, ...assignments] = process.argv.slice(2);
const env = { ...process.env };
for (const assignment of assignments) {
  const separator = assignment.indexOf('=');
  env[assignment.slice(0, separator)] = assignment.slice(separator + 1);
}

// Le délai évite qu'un serveur qui démarrerait par erreur bloque la CI.
const { status, stdout, stderr } = spawnSync(process.execPath, ['dist/server/main.js'], {
  env,
  encoding: 'utf8',
  timeout: 10_000,
});
const output = `${stdout}${stderr}`;
const description = assignments.join(' ');

if (status === 0 || status === null) {
  console.error(`Le serveur aurait dû refuser de démarrer (${description}). Sortie :\n${output}`);
  process.exit(1);
}
if (!output.includes(message) || /^\s+at /m.test(output)) {
  console.error(`Attendu : le message « ${message} » sans stack trace (${description}). Obtenu :\n${output}`);
  process.exit(1);
}

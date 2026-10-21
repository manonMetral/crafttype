#!/usr/bin/env bash
# Génère une application complète avec tous les modules, puis l'installe, la compile et lance ses tests.
# Usage : tests-ci/generate.sh [dossier-de-sortie]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$(mktemp -d)/fullapp}"
CRAFTTYPE=(npx --prefix "$ROOT" tsx "$ROOT/src/shared/module/infrastructure/primary/main.ts")

# Tous les modules du catalogue, dans l'ordre de `crafttype list` (les dépendances viennent avant).
# Le nom du projet n'est demandé que par `init` : les autres modules le relisent dans l'historique.
mapfile -t MODULES < <("${CRAFTTYPE[@]}" list | awk '{ print $1 }')
for module in "${MODULES[@]}"; do
  if [ "$module" = init ]; then
    "${CRAFTTYPE[@]}" apply "$module" --project-folder "$APP" --project-name fullapp
  else
    "${CRAFTTYPE[@]}" apply "$module" --project-folder "$APP"
  fi
done

cd "$APP"
npm install
npm run format:check
npm run typecheck
npm test
npm run server:build
npm run webapp:build

# Une configuration invalide arrête le serveur avec un message d'erreur, sans stack trace. Le délai évite qu'un
# serveur qui démarrerait par erreur bloque la CI.
expect_startup_error() {
  local message="$1"
  shift
  local output
  if output=$(timeout 10 env "$@" node dist/server/main.js 2>&1); then
    echo "Le serveur aurait dû refuser : $*" >&2
    exit 1
  fi
  if [[ "$output" != *"$message"* || "$output" == *"    at "* ]]; then
    echo "Attendu : le message « $message » sans stack trace ($*). Obtenu :" >&2
    echo "$output" >&2
    exit 1
  fi
}
expect_startup_error 'PORT invalide' PORT=abc
expect_startup_error 'LOG_LEVEL invalide' LOG_LEVEL=bavard
echo "OK : $APP"

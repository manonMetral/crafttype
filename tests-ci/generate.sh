#!/usr/bin/env bash
# Génère une application complète avec tous les modules, puis l'installe, la compile et lance ses tests.
# Usage : tests-ci/generate.sh [dossier-de-sortie]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$(mktemp -d)/fullapp}"
CRAFTTYPE=(npx --prefix "$ROOT" tsx "$ROOT/src/shared/module/infrastructure/primary/main.ts")

# Tous les modules du catalogue, dans l'ordre de `crafttype list` (les dépendances viennent avant).
# Le nom du projet n'est demandé que par `init` : les autres modules le relisent dans l'historique.
# (boucle plutôt que `mapfile`, absent du bash 3.2 de macOS)
MODULES=()
while IFS= read -r module; do
  MODULES+=("$module")
done < <("${CRAFTTYPE[@]}" list | awk '{ print $1 }')
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
npm run webapp:typecheck
npm test
npm run server:build
npm run webapp:build

# Le typage du front doit refuser une erreur de type dans un fichier .ts.
echo "export const probe: number = 'texte';" > src/webapp/probe.ts
if npm run webapp:typecheck > /dev/null 2>&1; then
  echo "webapp:typecheck aurait dû refuser une erreur de type dans src/webapp/probe.ts" >&2
  exit 1
fi
rm src/webapp/probe.ts

# Une configuration invalide arrête le serveur avec un message d'erreur, sans stack trace.
node "$ROOT/tests-ci/expect-startup-error.mjs" 'PORT invalide' PORT=abc
node "$ROOT/tests-ci/expect-startup-error.mjs" 'LOG_LEVEL invalide' LOG_LEVEL=bavard
echo "OK : $APP"

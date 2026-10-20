#!/usr/bin/env bash
# Génère une application complète avec tous les modules, puis l'installe, la compile et lance ses tests.
# Usage : tests-ci/generate.sh [dossier-de-sortie]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$(mktemp -d)/fullapp}"
CRAFTTYPE=(npx --prefix "$ROOT" tsx "$ROOT/src/shared/module/infrastructure/primary/main.ts")

for module in init typescript vitest fastify-server vue-app; do
  "${CRAFTTYPE[@]}" apply "$module" --project-folder "$APP" --project-name fullapp
done

cd "$APP"
npm install
npm run typecheck
npm test
npm run server:build
npm run webapp:build
echo "OK : $APP"

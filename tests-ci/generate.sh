#!/usr/bin/env bash
# Generates a complete application with all modules, then installs it, builds it and runs its tests.
# Usage: tests-ci/generate.sh [output-folder]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP="${1:-$(mktemp -d)/fullapp}"
CRAFTTYPE=(npx --prefix "$ROOT" tsx "$ROOT/src/shared/module/infrastructure/primary/main.ts")

# All catalog modules, in the order of `crafttype list` (dependencies come first).
# Only `init` takes the project name: the other modules read it back from the history.
# (loop rather than `mapfile`, which is missing from macOS bash 3.2)
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
# The CI workflow is checked by `format:check` below (Prettier parses and formats the YAML).
test -f .github/workflows/ci.yml
# Every script the workflow runs without `--if-present` must exist in the generated project.
for script in $(sed -n 's/^ *- run: npm run \([a-z:-]*\)$/\1/p' .github/workflows/ci.yml); do
  npm run | grep -q "^  $script\$" || { echo "workflow runs npm run $script, which does not exist" >&2; exit 1; }
done
npm run format:check
npm run typecheck
npm run webapp:typecheck
npm test
npm run server:build
npm run webapp:build

# Front-end typing must reject a type error in a .ts file.
echo "export const probe: number = 'text';" > src/webapp/probe.ts
if npm run webapp:typecheck > /dev/null 2>&1; then
  echo "webapp:typecheck should have rejected a type error in src/webapp/probe.ts" >&2
  exit 1
fi
rm src/webapp/probe.ts

# An invalid configuration stops the server with an error message, without a stack trace.
node "$ROOT/tests-ci/expect-startup-error.mjs" 'Invalid PORT' PORT=abc
node "$ROOT/tests-ci/expect-startup-error.mjs" 'Invalid LOG_LEVEL' LOG_LEVEL=verbose
echo "OK : $APP"

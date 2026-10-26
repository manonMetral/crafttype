#!/usr/bin/env bash
# Generates a complete application with all modules, then installs it, builds it and runs its tests.
# Usage: tests-ci/generate.sh [output-folder]
# By default the CLI runs from the sources (tsx). With CRAFTTYPE_BIN=/path/to/crafttype it runs that installed binary
# instead (used by the CI to test the packed tarball).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
if [ $# -ge 1 ]; then
  APP="$1"
else
  WORK="$(mktemp -d)"
  APP="$WORK/fullapp"
fi
IMAGE=""
CONTAINER=""
SERVER_PID=""
cleanup() {
  status=$?
  [ -z "$SERVER_PID" ] || kill "$SERVER_PID" > /dev/null 2>&1 || true
  [ -z "$CONTAINER" ] || docker rm -f "$CONTAINER" > /dev/null 2>&1 || true
  [ -z "$IMAGE" ] || docker rmi -f "$IMAGE" > /dev/null 2>&1 || true
  # The generated application (with node_modules) is only removed on success: after a failure it is kept to investigate.
  if [ -n "${WORK:-}" ]; then
    if [ $status -eq 0 ]; then rm -rf "$WORK"; else echo "Kept for investigation: $APP" >&2; fi
  fi
}
trap cleanup EXIT
if [ -n "${CRAFTTYPE_BIN:-}" ]; then
  CRAFTTYPE=("$CRAFTTYPE_BIN")
else
  CRAFTTYPE=(npx --prefix "$ROOT" tsx "$ROOT/src/shared/module/infrastructure/primary/main.ts")
fi

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
node "$ROOT/tests-ci/expect-startup-error.mjs" 'Invalid OPENAPI_DOCS' OPENAPI_DOCS=maybe

# The built server describes its routes (module `openapi`): the OpenAPI document and the Swagger UI answer, and
# production serves neither by default. Each server listens on a free port and is stopped whatever happens.
free_port() {
  node -e "const s = require('node:net').createServer(); s.listen(0, '127.0.0.1', () => { console.log(s.address().port); s.close(); });"
}
wait_for_health() {
  for _ in $(seq 1 30); do
    curl --silent --fail "http://127.0.0.1:$1/api/health" > /dev/null && return 0
    sleep 1
  done
  echo "the server does not answer on /api/health (port $1)" >&2
  exit 1
}
stop_server() {
  kill "$SERVER_PID" > /dev/null 2>&1 || true
  wait "$SERVER_PID" > /dev/null 2>&1 || true
  SERVER_PID=""
}

SERVER_PORT="$(free_port)"
PORT="$SERVER_PORT" node dist/server/main.js > /dev/null 2>&1 &
SERVER_PID=$!
wait_for_health "$SERVER_PORT"
curl --silent --fail "http://127.0.0.1:$SERVER_PORT/api/openapi.json" | node -e "
  const document = JSON.parse(require('node:fs').readFileSync(0, 'utf8'));
  if (!/^3\.1\./.test(document.openapi)) throw new Error('openapi version: ' + document.openapi);
  if (document.info.title !== 'fullapp') throw new Error('title: ' + document.info.title);
  if (!document.paths['/api/health']) throw new Error('the health route is not described');
  if (!document.paths['/api/greeting']) throw new Error('the greeting route is not described');
"
curl --silent --fail "http://127.0.0.1:$SERVER_PORT/api/docs/" | grep -qi 'swagger' \
  || { echo "/api/docs does not serve the Swagger UI" >&2; exit 1; }
stop_server

SERVER_PORT="$(free_port)"
NODE_ENV=production PORT="$SERVER_PORT" node dist/server/main.js > /dev/null 2>&1 &
SERVER_PID=$!
wait_for_health "$SERVER_PORT"
if curl --silent --fail "http://127.0.0.1:$SERVER_PORT/api/openapi.json" > /dev/null 2>&1; then
  echo "NODE_ENV=production should not serve /api/openapi.json by default" >&2
  exit 1
fi
if curl --silent --fail "http://127.0.0.1:$SERVER_PORT/api/docs/" > /dev/null 2>&1; then
  echo "NODE_ENV=production should not serve /api/docs by default" >&2
  exit 1
fi
stop_server
# With CRAFTTYPE_DOCKER=1 (needs Docker): the image builds, the container becomes healthy and answers on /api/health.
if [ -n "${CRAFTTYPE_DOCKER:-}" ]; then
  IMAGE="crafttype-fullapp:$$"
  docker build --quiet -t "$IMAGE" .
  CONTAINER="$(docker run -d -p 127.0.0.1::3000 "$IMAGE")"
  HOST_PORT="$(docker port "$CONTAINER" 3000/tcp | head -n 1 | sed 's/.*://')"
  for _ in $(seq 1 30); do
    curl --silent --fail "http://127.0.0.1:$HOST_PORT/api/health" | grep -q '"UP"' && break
    sleep 1
  done
  curl --silent --fail "http://127.0.0.1:$HOST_PORT/api/health" | grep -q '"UP"' \
    || { echo "the container does not answer on /api/health" >&2; docker logs "$CONTAINER" >&2; exit 1; }
  for _ in $(seq 1 40); do
    [ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" = healthy ] && break
    sleep 1
  done
  [ "$(docker inspect --format '{{.State.Health.Status}}' "$CONTAINER")" = healthy ] \
    || { echo "the container healthcheck is not healthy" >&2; exit 1; }
  # The container does not run as root.
  [ "$(docker exec "$CONTAINER" id -u)" != 0 ] || { echo "the container runs as root" >&2; exit 1; }
fi
if [ -n "${WORK:-}" ]; then
  echo "OK (temporary folder removed)"
else
  echo "OK : $APP"
fi

#!/usr/bin/env bash
# One command to put the current checkout on this server (ticket S7).
#
#   scripts/deploy.sh
#
# It builds an image tagged with the git commit, keeps the previous image as
# `argo:previous`, starts the new container, and waits for the health check.
# If the new container is not healthy, it puts the previous one back and fails.
#
# Settings come from an env file on the server, never from the repo:
#   ARGO_ENV_FILE   default /etc/argo/argo.env  (KEY=value lines, no quotes)
#   ARGO_CONTAINER  default argo
#   ARGO_PORT       default 3100  (the container listens on 127.0.0.1 only;
#                                  the reverse proxy is what the internet sees)
set -euo pipefail
cd "$(dirname "$0")/.."

ENV_FILE="${ARGO_ENV_FILE:-/etc/argo/argo.env}"
NAME="${ARGO_CONTAINER:-argo}"
PORT="${ARGO_PORT:-3100}"

[ -r "$ENV_FILE" ] || { echo "Env file not found or unreadable: $ENV_FILE" >&2; exit 1; }
for v in NEXT_PUBLIC_CONVEX_URL NEXT_PUBLIC_CONVEX_SITE_URL; do
  grep -q "^$v=." "$ENV_FILE" || { echo "$v is missing from $ENV_FILE" >&2; exit 1; }
done

SHA="$(git rev-parse --short HEAD)"
if ! git diff --quiet HEAD -- 2>/dev/null; then SHA="$SHA-dirty"; fi

# Build arguments: only the NEXT_PUBLIC_* lines, which the browser code needs.
BUILD_ARGS=()
while IFS= read -r line; do
  BUILD_ARGS+=(--build-arg "$line")
done < <(grep -E '^NEXT_PUBLIC_[A-Z0-9_]+=.' "$ENV_FILE")

echo "Building argo:$SHA"
docker build -t "argo:$SHA" "${BUILD_ARGS[@]}" .

PREV_IMAGE="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"
if [ -n "$PREV_IMAGE" ] && [ "$PREV_IMAGE" != "argo:$SHA" ]; then
  docker tag "$PREV_IMAGE" argo:previous
  echo "Kept $PREV_IMAGE as argo:previous"
fi

run_container() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" --restart unless-stopped \
    --env-file "$ENV_FILE" -p "127.0.0.1:$PORT:3000" "$1" >/dev/null
}

healthy() {
  for _ in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

run_container "argo:$SHA"
if healthy; then
  echo "Healthy: argo:$SHA is serving on 127.0.0.1:$PORT"
  exit 0
fi

echo "argo:$SHA did not become healthy." >&2
docker logs --tail 30 "$NAME" >&2 || true
if docker image inspect argo:previous >/dev/null 2>&1; then
  echo "Rolling back to argo:previous" >&2
  run_container argo:previous
  healthy && echo "Rolled back." >&2
fi
exit 1

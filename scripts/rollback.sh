#!/usr/bin/env bash
# Put the previous build back (ticket S7). Run it after a deploy that looks wrong.
#
#   scripts/rollback.sh
#
# Swaps `argo:previous` in as the running container and keeps the build it
# replaces as `argo:rolledback`, so you can swap forward again.
set -euo pipefail

ENV_FILE="${ARGO_ENV_FILE:-/etc/argo/argo.env}"
NAME="${ARGO_CONTAINER:-argo}"
PORT="${ARGO_PORT:-3100}"

docker image inspect argo:previous >/dev/null 2>&1 || { echo "There is no previous build to go back to." >&2; exit 1; }

CURRENT="$(docker inspect -f '{{.Config.Image}}' "$NAME" 2>/dev/null || true)"
[ -n "$CURRENT" ] && docker tag "$CURRENT" argo:rolledback

docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" --restart unless-stopped \
  --env-file "$ENV_FILE" -p "127.0.0.1:$PORT:3000" argo:previous >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null 2>&1; then
    echo "Rolled back: argo:previous is serving on 127.0.0.1:$PORT"
    exit 0
  fi
  sleep 1
done
echo "The previous build did not become healthy either. Check: docker logs $NAME" >&2
exit 1

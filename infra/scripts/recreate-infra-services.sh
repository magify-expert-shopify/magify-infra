#!/bin/bash
set -euo pipefail

# Recreate the Raspberry infra stack from scratch:
# - PostgreSQL
# - Redis
# - Nginx Proxy Manager
#
# The database stack is defined in infra/compose/docker-compose.databases.yml.
# The proxy manager compose file is configurable because it is not stored in this repo.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASE_DIR="${BASE_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
COMPOSE_DIR="${COMPOSE_DIR:-$BASE_DIR/compose}"
ENV_FILE="${ENV_FILE:-$COMPOSE_DIR/.env.prod}"
DB_COMPOSE_FILE="${DB_COMPOSE_FILE:-$COMPOSE_DIR/docker-compose.databases.yml}"
PROXY_COMPOSE_FILE="${PROXY_COMPOSE_FILE:-/home/admin/apps/magify-nginx-proxy-manager/docker-compose.yml}"
PROXY_CONTAINER_NAME="${PROXY_CONTAINER_NAME:-magify-nginx-proxy-manager}"

compose_down() {
  local compose_file="$1"

  if [ -f "$compose_file" ]; then
    echo "Stopping stack: $compose_file"
    docker compose --env-file "$ENV_FILE" -f "$compose_file" down --volumes --remove-orphans
  else
    echo "Skipping missing compose file: $compose_file"
  fi
}

remove_container_if_exists() {
  local container_name="$1"

  if docker ps -a --format '{{.Names}}' | grep -qx "$container_name"; then
    echo "Removing stale container: $container_name"
    docker rm -f "$container_name" >/dev/null
  fi
}

echo "Using env file: $ENV_FILE"
echo "Using database compose: $DB_COMPOSE_FILE"
echo "Using proxy compose: $PROXY_COMPOSE_FILE"

compose_down "$DB_COMPOSE_FILE"
remove_container_if_exists "magify-postgree"
remove_container_if_exists "magify-db-import"
remove_container_if_exists "magify-redis"

if [ -f "$PROXY_COMPOSE_FILE" ]; then
  compose_down "$PROXY_COMPOSE_FILE"
elif docker ps -a --format '{{.Names}}' | grep -qx "$PROXY_CONTAINER_NAME"; then
  echo "Stopping standalone proxy container: $PROXY_CONTAINER_NAME"
  proxy_image="$(docker inspect -f '{{.Config.Image}}' "$PROXY_CONTAINER_NAME" 2>/dev/null || true)"
  docker rm -f "$PROXY_CONTAINER_NAME"
  if [ -n "${proxy_image:-}" ]; then
    docker image rm -f "$proxy_image" || true
  fi
else
  echo "Proxy manager not found, skipping standalone cleanup."
fi

echo "Recreating database stack..."
docker compose --env-file "$ENV_FILE" -f "$DB_COMPOSE_FILE" up -d

if [ -f "$PROXY_COMPOSE_FILE" ]; then
  echo "Recreating proxy manager..."
  docker compose --env-file "$ENV_FILE" -f "$PROXY_COMPOSE_FILE" up -d
else
  echo "Proxy manager compose file not found, recreation skipped."
fi

echo "Infrastructure recreation complete."

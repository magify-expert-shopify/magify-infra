#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"

ENV_FILE="$REPO_ROOT/infra/compose/.env.prod"
POSTGRES_IMAGE_NAME="magify-postgree:17"
POSTGRES_DOCKERFILE="$REPO_ROOT/infra/db/Dockerfile"
POSTGRES_BUILD_CONTEXT="$REPO_ROOT/infra/db"
NETWORK_NAME="magify-network"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env introuvable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ensure_network "$NETWORK_NAME"
docker build \
  --pull \
  --file "$POSTGRES_DOCKERFILE" \
  --tag "$POSTGRES_IMAGE_NAME" \
  "$POSTGRES_BUILD_CONTEXT"

remove_container_if_exists "magify-postgree"

docker run -d \
  --name magify-postgree \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  -p "${POSTGRES_PORT:-5432}:5432" \
  --health-cmd "pg_isready -U ${POSTGRES_ADMIN_USER} -d postgres" \
  --health-interval 10s \
  --health-timeout 5s \
  --health-retries 10 \
  -e POSTGRES_DB=postgres \
  -e POSTGRES_PASSWORD="$POSTGRES_ADMIN_PASSWORD" \
  -e POSTGRES_USER="$POSTGRES_ADMIN_USER" \
  -v magify-postgree-data:/var/lib/postgresql/data \
  "$POSTGRES_IMAGE_NAME"

wait_for_healthy "magify-postgree" 180

echo "Container PostgreSQL demarre."

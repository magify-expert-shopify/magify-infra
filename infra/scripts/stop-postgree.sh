#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"

ENV_FILE="$REPO_ROOT/infra/compose/.env.prod"
DB_COMPOSE_FILE="$REPO_ROOT/infra/compose/docker-compose.databases.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env introuvable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ensure_network "magify-network"

compose_args=(
  docker compose
  --env-file "$ENV_FILE"
  -f "$DB_COMPOSE_FILE"
)

"${compose_args[@]}" down -v --remove-orphans || true
docker rmi -f magify-postgree:17 || true

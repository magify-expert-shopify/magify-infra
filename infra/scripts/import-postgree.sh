#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"

ENV_FILE="$REPO_ROOT/infra/compose/.env.prod"
NETWORK_NAME="magify-network"
DB_COMPOSE_FILE="$REPO_ROOT/infra/compose/docker-compose.databases.yml"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env introuvable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ensure_network "$NETWORK_NAME"
compose_args=(
  docker compose
  --env-file "$ENV_FILE"
  -f "$DB_COMPOSE_FILE"
  --profile import
)

"${compose_args[@]}" up --force-recreate --abort-on-container-exit --exit-code-from magify-db-import magify-db-import

echo "Import PostgreSQL termine."

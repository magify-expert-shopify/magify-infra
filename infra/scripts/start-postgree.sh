#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"
source "$SCRIPT_DIR/print-database-tables-summary.sh"

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
)

if [[ "${POSTGREE_NO_CACHE:-0}" == "1" ]]; then
  "${compose_args[@]}" build --pull --no-cache magify-postgree
else
  "${compose_args[@]}" build --pull magify-postgree
fi

"${compose_args[@]}" up -d --force-recreate magify-postgree

wait_for_healthy "magify-postgree" 180

print_database_tables_summary "${BLOG_POSTGRES_DB:-blog}"
print_database_tables_summary "${PROSPECTION_POSTGRES_DB:-prospection}"
print_database_tables_summary "${SOCIAL_POSTGRES_DB:-social}"

echo "Container PostgreSQL demarre."

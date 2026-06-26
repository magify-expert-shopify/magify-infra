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

print_database_tables_summary() {
  local database_name="$1"

  echo
  echo "Contenu de la base ${database_name}:"

  docker exec -i \
    -e PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" \
    magify-postgree \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$database_name" -At <<'SQL'
\echo
SELECT format(
  'SELECT %L AS table_name, count(*) AS row_count FROM %I.%I;',
  tablename,
  schemaname,
  tablename
)
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
\gexec
\echo
SQL
}

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env introuvable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

ensure_network "$NETWORK_NAME"
docker_build_args=(--pull --file "$POSTGRES_DOCKERFILE" --tag "$POSTGRES_IMAGE_NAME")

if [[ "${POSTGREE_NO_CACHE:-0}" == "1" ]]; then
  docker_build_args+=(--no-cache)
fi

docker_build_args+=("$POSTGRES_BUILD_CONTEXT")

docker build "${docker_build_args[@]}"

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

print_database_tables_summary "${BLOG_POSTGRES_DB:-blog}"
print_database_tables_summary "${PROSPECTION_POSTGRES_DB:-prospection}"
print_database_tables_summary "${SOCIAL_POSTGRES_DB:-social}"

echo "Container PostgreSQL demarre."

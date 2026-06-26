#!/usr/bin/env bash
set -euo pipefail

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

print_database_users_summary() {
  local database_name="$1"

  echo
  echo "Users visibles dans la base ${database_name}:"

  docker exec -i \
    -e PGPASSWORD="$POSTGRES_ADMIN_PASSWORD" \
    magify-postgree \
    psql -v ON_ERROR_STOP=1 -U "$POSTGRES_ADMIN_USER" -d "$database_name" -At <<'SQL'
\echo
SELECT
  r.rolname AS role_name,
  r.rolsuper AS is_superuser,
  r.rolcreatedb AS can_create_db,
  r.rolcreaterole AS can_create_role
FROM pg_roles r
WHERE r.rolname IN ('admin', 'magify')
ORDER BY r.rolname;
\echo
SQL
}

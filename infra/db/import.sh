#!/bin/sh
set -eu

PGHOST="${POSTGRES_HOST:-magify-postgree}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_APP_USER:-magify}"
PGPASSWORD="${POSTGRES_APP_PASSWORD:-brunstad}"

require_source() {
  source_path="$1"

  if [ ! -s "$source_path" ]; then
    echo "⚠️  Fichier absent ou vide : $source_path. Import ignoré."
    return 1
  fi

  return 0
}

import_sqlite() {
  source_path="$1"
  target_db="$2"
  load_file="/tmp/${target_db}.load"

  echo "Importing $source_path into $target_db"

  cat > "$load_file" <<EOF
LOAD DATABASE
     FROM sqlite://$source_path
     INTO postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${target_db}

 WITH include drop, create tables, create indexes, reset sequences, foreign keys

 EXCLUDING TABLE NAMES LIKE '_prisma_migrations'
;
EOF

  pgloader "$load_file"
}

require_source /db/blog.db && \
  import_sqlite /db/blog.db "${BLOG_POSTGRES_DB:-blog}"

require_source /db/prospection.db && \
  import_sqlite /db/prospection.db "${PROSPECTION_POSTGRES_DB:-prospection}"

require_source /db/social.db && \
  import_sqlite /db/social.db "${SOCIAL_POSTGRES_DB:-social}"

echo "Import PostgreSQL terminé."
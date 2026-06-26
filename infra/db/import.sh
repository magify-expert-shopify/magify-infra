#!/bin/sh
set -eu

PGHOST="${POSTGRES_HOST:-magify-postgree}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_ADMIN_USER:-admin}"
PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-brunstad}"

import_sqlite() {
  source_path="$1"
  target_db="$2"
  load_file="/tmp/${target_db}.load"

  if [ ! -s "$source_path" ]; then
    echo "Skipping $source_path: file is missing or empty."
    return 0
  fi

  echo "Importing $source_path into $target_db"
  cat > "$load_file" <<EOF
LOAD DATABASE
     FROM sqlite://$source_path
     INTO postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${target_db}

 WITH include drop, create tables, create indexes, reset sequences, foreign keys

 EXCLUDING TABLE NAMES MATCHING '_prisma_migrations'
;
EOF
  pgloader "$load_file"
}

import_sqlite /db/blog.db "${BLOG_POSTGRES_DB:-blog}"
import_sqlite /db/prospection.db "${PROSPECTION_POSTGRES_DB:-prospection}"
import_sqlite /db/social.db "${SOCIAL_POSTGRES_DB:-social}"

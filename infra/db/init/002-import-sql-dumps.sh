#!/bin/sh
set -eu

SQL_DUMP_DIR="/docker-entrypoint-initdb.d/sql"

export PGPASSWORD="${POSTGRES_PASSWORD:-}"

import_dump() {
  dump_file="$1"
  target_db="$2"

  if [ ! -s "$dump_file" ]; then
    echo "Skipping $dump_file: file is missing or empty."
    return 0
  fi

  echo "Importing SQL dump: $(basename "$dump_file") -> database: $target_db"
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$target_db" -f "$dump_file"
}

import_dump "$SQL_DUMP_DIR/blog.sql" "${BLOG_POSTGRES_DB:-blog}"
import_dump "$SQL_DUMP_DIR/prospection.sql" "${PROSPECTION_POSTGRES_DB:-prospection}"
import_dump "$SQL_DUMP_DIR/social.sql" "${SOCIAL_POSTGRES_DB:-social}"

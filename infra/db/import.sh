#!/bin/sh
set -eu

PGHOST="${POSTGRES_HOST:-magify-postgree}"
PGPORT="${POSTGRES_PORT:-5432}"
PGUSER="${POSTGRES_ADMIN_USER:-admin}"
PGPASSWORD="${POSTGRES_ADMIN_PASSWORD:-brunstad}"

import_sqlite() {
  source_path="$1"
  target_db="$2"

  if [ ! -s "$source_path" ]; then
    echo "Skipping $source_path: file is missing or empty."
    return 0
  fi

  echo "Importing $source_path into $target_db"
  pgloader "sqlite://$source_path" "postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${target_db}"
}

import_sqlite /db/blog.db "${BLOG_POSTGRES_DB:-blog}"
import_sqlite /db/prospection.db "${PROSPECTION_POSTGRES_DB:-prospection}"
import_sqlite /db/social.db "${SOCIAL_POSTGRES_DB:-social}"

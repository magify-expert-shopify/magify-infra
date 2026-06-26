#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"

CONTAINER_NAME="magify-postgree"
VOLUME_NAME="magify-postgree-data"

remove_container_if_exists "$CONTAINER_NAME"
remove_volume_if_exists "$VOLUME_NAME"

echo "PostgreSQL container and volume removed."

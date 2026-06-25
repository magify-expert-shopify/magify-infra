#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$REPO_ROOT/infra/scripts/docker-prod-common.sh"

CONTAINER_NAME="magify-dashboard"

get_container_volume_names() {
  local container_name="$1"

  docker inspect \
    --format '{{range .Mounts}}{{if eq .Type "volume"}}{{.Name}} {{end}}{{end}}' \
    "$container_name" 2>/dev/null || true
}

volume_names="$(get_container_volume_names "$CONTAINER_NAME")"

remove_container_if_exists "$CONTAINER_NAME"

for volume_name in $volume_names; do
  remove_volume_if_exists "$volume_name"
done

echo "Dashboard prod stopped."

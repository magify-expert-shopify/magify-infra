#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$REPO_ROOT/infra/scripts/docker-prod-common.sh"

CONTAINER_NAME="prospection-api"

get_container_volume_names() {
  local container_name="$1"

  local mounts_json
  mounts_json="$(docker inspect --format '{{json .Mounts}}' "$container_name" 2>/dev/null || true)"
  if [[ -z "$mounts_json" || "$mounts_json" == "null" ]]; then
    return 0
  fi

  python3 - "$mounts_json" <<'PY'
import json
import sys

mounts = json.loads(sys.argv[1])
if isinstance(mounts, dict):
    mounts = [mounts]

for mount in mounts:
    if mount.get("Type") == "volume" and mount.get("Name"):
        print(mount["Name"])
PY
}

volume_names="$(get_container_volume_names "$CONTAINER_NAME")"

remove_container_if_exists "$CONTAINER_NAME"

for volume_name in $volume_names; do
  remove_volume_if_exists "$volume_name"
done

echo "prospection-api prod stopped."

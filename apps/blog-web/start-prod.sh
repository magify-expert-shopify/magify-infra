#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$REPO_ROOT/infra/scripts/docker-prod-common.sh"

ENV_FILE="$SCRIPT_DIR/.env.prod"
NETWORK_NAME="magify-network"
CONTAINER_NAME="blog-web"
IMAGE_NAME="magify-blog-web:prod"
# IMAGE_NAME="ghcr.io/magify-expert-shopify/magify-blog-web:latest"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Fichier env introuvable: $ENV_FILE"
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

build_args=()
while IFS= read -r raw_line; do
  line="${raw_line#"${raw_line%%[![:space:]]*}"}"
  line="${line%"${line##*[![:space:]]}"}"

  if [[ -z "$line" || "${line:0:1}" == "#" ]]; then
    continue
  fi

  name="${line%%=*}"
  if [[ "$name" == "$line" ]]; then
    continue
  fi

  name="${name%"${name##*[![:space:]]}"}"
  name="${name#"${name%%[![:space:]]*}"}"
  build_args+=(--build-arg "$name=${!name-}")
done < "$ENV_FILE"

docker build \
  -f "$REPO_ROOT/apps/blog-web/Dockerfile.prod" \
  "${build_args[@]}" \
  -t "$IMAGE_NAME" \
  "$REPO_ROOT"

ensure_network "$NETWORK_NAME"
# docker pull "$IMAGE_NAME"
remove_container_if_exists "$CONTAINER_NAME"

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --env-file "$ENV_FILE" \
  "$IMAGE_NAME"

echo "blog-web prod demarre."

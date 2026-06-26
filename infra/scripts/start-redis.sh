#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/docker-prod-common.sh"

NETWORK_NAME="magify-network"
CONTAINER_NAME="magify-redis"
IMAGE_NAME="redis:7-alpine"

ensure_network "$NETWORK_NAME"
# docker pull "$IMAGE_NAME"
remove_container_if_exists "$CONTAINER_NAME"

docker run -d \
  --name "$CONTAINER_NAME" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  -p 6379:6379 \
  "$IMAGE_NAME" \
  redis-server --appendonly yes

echo "Redis prod demarre."
docker ps --filter "name=^/${CONTAINER_NAME}$" --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"

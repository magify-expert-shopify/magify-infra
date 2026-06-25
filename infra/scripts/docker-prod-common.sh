#!/usr/bin/env bash

# Force a stable Docker platform on hosts that default to amd64/v3.
: "${DOCKER_DEFAULT_PLATFORM:=linux/amd64}"
export DOCKER_DEFAULT_PLATFORM

ensure_network() {
  local network_name="$1"

  if ! docker network inspect "$network_name" >/dev/null 2>&1; then
    docker network create "$network_name" >/dev/null
  fi
}

remove_container_if_exists() {
  local container_name="$1"

  if docker ps -a --format '{{.Names}}' | grep -qx "$container_name"; then
    docker rm -f "$container_name" >/dev/null
  fi
}

remove_volume_if_exists() {
  local volume_name="$1"

  if docker volume ls --format '{{.Name}}' | grep -qx "$volume_name"; then
    docker volume rm "$volume_name" >/dev/null
  fi
}

wait_for_healthy() {
  local container_name="$1"
  local timeout_seconds="${2:-180}"
  local deadline=$((SECONDS + timeout_seconds))

  while true; do
    if ! docker ps -a --format '{{.Names}}' | grep -qx "$container_name"; then
      if (( SECONDS >= deadline )); then
        echo "Container introuvable: $container_name"
        return 1
      fi
      sleep 3
      continue
    fi

    local status
    status="$(docker inspect -f '{{.State.Health.Status}}' "$container_name" 2>/dev/null || true)"

    if [[ "$status" == "healthy" ]]; then
      return 0
    fi

    if [[ "$status" == "unhealthy" ]]; then
      docker logs --tail 50 "$container_name" || true
      return 1
    fi

    if (( SECONDS >= deadline )); then
      docker logs --tail 50 "$container_name" || true
      return 1
    fi

    sleep 3
  done
}

#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_DIR="$(cd "$SCRIPT_DIR/../compose" && pwd)"

cd "$COMPOSE_DIR"

echo "Pull des nouvelles images..."
# docker compose --env-file .env.prod -f docker-compose.databases.yml pull
# docker compose --env-file .env.prod -f docker-compose.prod.yml pull
# docker compose --env-file .env.prod -f docker-compose.nginx-proxy-manager.yml pull

echo "Redémarrage des services..."
# docker compose --env-file .env.prod -f docker-compose.databases.yml up -d
# docker compose --env-file .env.prod -f docker-compose.prod.yml up -d
# docker compose --env-file .env.prod -f docker-compose.nginx-proxy-manager.yml up -d

echo "Nettoyage..."
# docker image prune -f

echo "Déploiement terminé."

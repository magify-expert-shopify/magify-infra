#!/bin/bash
set -e

cd /home/admin/apps/magify-apps/infra/compose

echo "Pull des nouvelles images..."
docker compose --env-file .env.prod -f docker-compose.databases.yml pull
docker compose --env-file .env.prod -f docker-compose.prod.yml pull

echo "Redémarrage des services..."
docker compose --env-file .env.prod -f docker-compose.databases.yml up -d
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d

echo "Nettoyage..."
docker image prune -f

echo "Déploiement terminé."

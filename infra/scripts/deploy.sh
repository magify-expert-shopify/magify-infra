#!/bin/bash
set -e

cd /home/admin/apps/magify-apps/infra

echo "Pull des nouvelles images..."
docker compose -f docker-compose.prod.yml pull

echo "Redémarrage des services..."
docker compose -f docker-compose.prod.yml up -d

echo "Nettoyage..."
docker image prune -f

echo "Déploiement terminé."
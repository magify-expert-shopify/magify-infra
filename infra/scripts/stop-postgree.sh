#!/usr/bin/env bash
set -euo pipefail

docker rm -f magify-postgree
docker volume rm magify-postgree-data

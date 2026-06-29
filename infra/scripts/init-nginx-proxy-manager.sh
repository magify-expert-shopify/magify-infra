#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/npm-proxy-common.sh"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

load_env_file "$REPO_ROOT/infra/compose/.env.prod"
load_env_file "$SCRIPT_DIR/.env"

: "${NPM_ADMIN_EMAIL:=tomderudder@gmail.com}"
: "${NPM_ADMIN_PASSWORD:=brunstad}"

ensure_command curl
ensure_command python3

wait_for_http "http://127.0.0.1:81" 180

token="$(npm_login_token "http://127.0.0.1:81" "$NPM_ADMIN_EMAIL" "$NPM_ADMIN_PASSWORD")"
if [[ -z "$token" ]]; then
  echo "Impossible de recuperer un token NPM."
  exit 1
fi

upsert_npm_proxy "http://127.0.0.1:81" "$token" "www.magify.duckdns.org" "magify-dashboard" "80"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "admin.magify.duckdns.org" "127.0.0.1" "81"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "blog.magify.duckdns.org" "blog-web" "3001"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "blog-api.magify.duckdns.org" "blog-api" "4001"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "prospection.magify.duckdns.org" "prospection-web" "3002"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "prospection-api.magify.duckdns.org" "prospection-api" "4002"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "social.magify.duckdns.org" "social-web" "3003"
upsert_npm_proxy "http://127.0.0.1:81" "$token" "social-api.magify.duckdns.org" "social-api" "4003"

echo "Proxy prod NPM initialises."

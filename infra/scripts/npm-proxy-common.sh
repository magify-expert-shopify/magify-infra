#!/usr/bin/env bash

load_env_file() {
  local file="$1"

  if [[ -f "$file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file"
    set +a
  fi
}

ensure_command() {
  local name="$1"

  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Commande requise introuvable: $name"
    exit 1
  fi
}

wait_for_http() {
  local url="$1"
  local timeout_seconds="${2:-180}"
  local deadline=$((SECONDS + timeout_seconds))
  local last_status=""

  while (( SECONDS < deadline )); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    last_status="$?"
    sleep 2
  done

  echo "Timeout en attendant $url (dernier statut curl: $last_status)"
  exit 1
}

npm_login_token() {
  local base_url="$1"
  local email="$2"
  local password="$3"
  local timeout_seconds="${4:-120}"
  local deadline=$((SECONDS + timeout_seconds))
  local response_file=""
  local http_code=""
  local token=""

  while (( SECONDS < deadline )); do
    response_file="$(mktemp)"
    http_code="$(curl -sS -o "$response_file" -w '%{http_code}' -X POST "$base_url/api/tokens" \
      -H 'Content-Type: application/json' \
      -d "{\"identity\":\"$email\",\"secret\":\"$password\"}" 2>/dev/null || true)"

    if [[ "$http_code" != 2* ]]; then
      echo "NPM login HTTP $http_code pour $email sur $base_url" >&2
      if [[ -s "$response_file" ]]; then
        echo "Reponse NPM:" >&2
        cat "$response_file" >&2
        echo >&2
      fi
      rm -f "$response_file"
      sleep 2
      continue
    fi

    token="$(python3 - "$response_file" <<'PY'
import json
import sys

path = sys.argv[1]

try:
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
except Exception:
    raise SystemExit(1)

token = data.get("token") or data.get("access_token") or ""
print(token)
PY
    )" || token=""

    rm -f "$response_file"

    if [[ -n "$token" ]]; then
      printf '%s' "$token"
      return 0
    fi

    sleep 2
  done

  echo "Impossible de recuperer un token NPM sur $base_url"
  return 1
}

npm_proxy_id_for_domain() {
  local domain="$1"
  local response_file="$2"

  python3 - "$domain" "$response_file" <<'PY'
import json
import sys

domain = sys.argv[1]
path = sys.argv[2]

with open(path, "r", encoding="utf-8") as handle:
    payload = json.load(handle)

items = payload.get("data") if isinstance(payload, dict) and isinstance(payload.get("data"), list) else payload

for item in items:
    if domain in (item.get("domain_names") or []):
        print(item.get("id") or "")
        break
PY
}

npm_proxy_body() {
  local domain="$1"
  local forward_host="$2"
  local forward_port="$3"

  python3 - "$domain" "$forward_host" "$forward_port" <<'PY'
import json
import sys

domain, forward_host, forward_port = sys.argv[1:4]

payload = {
    "domain_names": [domain],
    "forward_scheme": "http",
    "forward_host": forward_host,
    "forward_port": int(forward_port),
    "access_list_id": 0,
    "certificate_id": 0,
    "ssl_forced": False,
    "caching_enabled": False,
    "block_exploits": True,
    "allow_websocket_upgrade": True,
    "advanced_config": "",
    "enabled": True,
    "meta": {"letsencrypt_agree": False, "dns_challenge": False},
}

print(json.dumps(payload))
PY
}

upsert_npm_proxy() {
  local base_url="$1"
  local token="$2"
  local domain="$3"
  local forward_host="$4"
  local forward_port="$5"
  local response_file
  local proxy_id
  local body

  response_file="$(mktemp)"
  trap 'rm -f "$response_file"' RETURN

  curl -fsS -H "Authorization: Bearer $token" "$base_url/api/nginx/proxy-hosts" >"$response_file"
  proxy_id="$(npm_proxy_id_for_domain "$domain" "$response_file")"
  body="$(npm_proxy_body "$domain" "$forward_host" "$forward_port")"

  if [[ -n "$proxy_id" ]]; then
    echo "Mise a jour proxy: $domain -> $forward_host:$forward_port"
    curl -fsS -X PUT "$base_url/api/nginx/proxy-hosts/$proxy_id" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body" >/dev/null
  else
    echo "Creation proxy: $domain -> $forward_host:$forward_port"
    curl -fsS -X POST "$base_url/api/nginx/proxy-hosts" \
      -H "Authorization: Bearer $token" \
      -H 'Content-Type: application/json' \
      -d "$body" >/dev/null
  fi

  trap - RETURN
  rm -f "$response_file"
}

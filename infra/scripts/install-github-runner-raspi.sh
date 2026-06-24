#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Utilisateur cible
# Si lancé avec sudo par admin => TARGET_USER=admin
# Si lancé sans sudo => TARGET_USER=user courant
# ============================================================
TARGET_USER="${TARGET_USER:-${SUDO_USER:-$(id -un)}}"

if [[ "$TARGET_USER" == "root" ]]; then
  echo "Erreur : évite d'installer le runner dans /root."
  echo "Lance le script avec un utilisateur normal, par exemple admin :"
  echo "sudo -E env REPO_URL='https://github.com/OWNER/REPO' RUNNER_TOKEN='TOKEN' ./install-github-runner-raspi.sh"
  exit 1
fi

USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

if [[ -z "$USER_HOME" || ! -d "$USER_HOME" ]]; then
  echo "Impossible de trouver le dossier home pour l'utilisateur : $TARGET_USER"
  exit 1
fi

# ============================================================
# Config
# ============================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/install-github-runner-raspi.env"

if [[ -f "$ENV_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$ENV_FILE"
fi

REPO_URL="${REPO_URL:-https://github.com/magify-expert-shopify/magify-infra}"
RUNNER_TOKEN="${RUNNER_TOKEN:-}"

RUNNER_NAME="${RUNNER_NAME:-raspi-$(hostname)}"
RUNNER_LABELS="${RUNNER_LABELS:-raspberry,docker,deploy}"

RUNNER_HOME="${RUNNER_HOME:-$USER_HOME/actions-runner}"
APP_DIR="${APP_DIR:-$USER_HOME/myapp}"
USER_BIN_DIR="${USER_BIN_DIR:-$USER_HOME/bin}"
DEPLOY_BIN="${DEPLOY_BIN:-$USER_BIN_DIR/deploy-containers}"

# ============================================================
# Vérifications
# ============================================================
if [[ "$EUID" -ne 0 ]]; then
  echo "Lance ce script avec sudo."
  exit 1
fi

if [[ -z "$REPO_URL" || -z "$RUNNER_TOKEN" ]]; then
  echo "Usage :"
  echo "sudo -E env REPO_URL='https://github.com/OWNER/REPO' RUNNER_TOKEN='TOKEN_GITHUB' ./install-github-runner-raspi.sh"
  exit 1
fi

echo "Installation pour l'utilisateur : $TARGET_USER"
echo "Home utilisateur              : $USER_HOME"
echo "Dossier runner                : $RUNNER_HOME"
echo "Dossier app                   : $APP_DIR"
echo "Script déploiement            : $DEPLOY_BIN"

# ============================================================
# Dépendances système
# ============================================================
apt-get update
apt-get install -y \
  curl \
  jq \
  tar \
  sudo \
  ca-certificates \
  gnupg \
  lsb-release \
  util-linux \
  rsync

# ============================================================
# Installation Docker si absent
# ============================================================
if ! command -v docker >/dev/null 2>&1; then
  echo "Docker absent. Installation..."
  curl -fsSL https://get.docker.com | sh
fi

systemctl enable --now docker

if ! docker compose version >/dev/null 2>&1; then
  echo "Installation du plugin Docker Compose..."
  apt-get install -y docker-compose-plugin || true
fi

# Ajout de l'utilisateur courant au groupe docker
usermod -aG docker "$TARGET_USER"

# ============================================================
# Création dossiers dans /home/admin ou équivalent
# ============================================================
mkdir -p "$RUNNER_HOME" "$APP_DIR" "$USER_BIN_DIR"
chown -R "$TARGET_USER:$TARGET_USER" "$RUNNER_HOME" "$APP_DIR" "$USER_BIN_DIR"

# ============================================================
# Détection architecture Raspberry
# ============================================================
case "$(uname -m)" in
  aarch64|arm64)
    RUNNER_ARCH="arm64"
    ;;
  armv7l|armv6l|armhf|arm)
    RUNNER_ARCH="arm"
    ;;
  x86_64|amd64)
    RUNNER_ARCH="x64"
    ;;
  *)
    echo "Architecture non supportée : $(uname -m)"
    exit 1
    ;;
esac

echo "Architecture détectée : $RUNNER_ARCH"

# ============================================================
# Téléchargement dernière version du runner GitHub
# ============================================================
LATEST_VERSION="$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | jq -r '.tag_name | sub("^v"; "")')"

if [[ -z "$LATEST_VERSION" || "$LATEST_VERSION" == "null" ]]; then
  echo "Impossible de récupérer la dernière version du runner GitHub."
  exit 1
fi

PKG="actions-runner-linux-${RUNNER_ARCH}-${LATEST_VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/actions/runner/releases/download/v${LATEST_VERSION}/${PKG}"

echo "Version runner GitHub : $LATEST_VERSION"

if [[ ! -f "$RUNNER_HOME/.runner" ]]; then
  sudo -u "$TARGET_USER" bash -lc "
    cd '$RUNNER_HOME'
    curl -fL -o '$PKG' '$DOWNLOAD_URL'
    tar xzf '$PKG'
    rm '$PKG'
  "

  bash "$RUNNER_HOME/bin/installdependencies.sh" || true
else
  echo "Runner déjà présent dans $RUNNER_HOME. Réutilisation de l'installation existante."
fi

if [[ -x "$RUNNER_HOME/svc.sh" ]]; then
  if systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null | grep -q '^actions\.runner\.'; then
    echo "Service systemd runner déjà présent. Réinitialisation avant reconfiguration."
    "$RUNNER_HOME/svc.sh" stop || true
    "$RUNNER_HOME/svc.sh" uninstall || true
  fi
fi

if [[ -f "$RUNNER_HOME/.runner" ]]; then
  echo "Nettoyage des fichiers de configuration locaux du runner."
  rm -f \
    "$RUNNER_HOME/.runner" \
    "$RUNNER_HOME/.credentials" \
    "$RUNNER_HOME/.credentials_rsaparams" \
    "$RUNNER_HOME/.service" \
    "$RUNNER_HOME/_diag"/*.log 2>/dev/null || true
fi

sudo -u "$TARGET_USER" bash -lc "
  cd '$RUNNER_HOME'
  ./config.sh \
    --unattended \
    --url '$REPO_URL' \
    --token '$RUNNER_TOKEN' \
    --name '$RUNNER_NAME' \
    --labels '$RUNNER_LABELS' \
    --work _work \
    --replace
"

# ============================================================
# Installation en service systemd
# Le service tournera sous l'utilisateur courant, ex: admin
# ============================================================
cd "$RUNNER_HOME"

if systemctl list-unit-files --type=service --no-legend --no-pager 2>/dev/null | grep -q '^actions\.runner\.'; then
  echo "Service systemd GitHub Actions runner déjà présent."
else
  ./svc.sh install "$TARGET_USER"
fi

./svc.sh start

# ============================================================
# Script de déploiement local dans /home/admin/bin
# ============================================================
cat > "$DEPLOY_BIN" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/myapp}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.yml}"
PROJECT_NAME="${PROJECT_NAME:-myapp}"
LOCK_FILE="/tmp/${PROJECT_NAME}-deploy.lock"

exec 9>"$LOCK_FILE"

if ! flock -n 9; then
  echo "Un déploiement est déjà en cours. Abandon."
  exit 1
fi

cd "$APP_DIR"

echo "Déploiement démarré : $(date -Iseconds)"
echo "Dossier app          : $APP_DIR"
echo "Compose file         : $COMPOSE_FILE"
echo "Projet Docker Compose: $PROJECT_NAME"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  echo "$GHCR_TOKEN" | docker login ghcr.io -u "$GHCR_USERNAME" --password-stdin
fi

docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" pull
docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" up -d --remove-orphans
docker image prune -f

docker compose -p "$PROJECT_NAME" -f "$COMPOSE_FILE" ps

echo "Déploiement terminé : $(date -Iseconds)"
EOF

chmod +x "$DEPLOY_BIN"
chown "$TARGET_USER:$TARGET_USER" "$DEPLOY_BIN"

echo ""
echo "Installation terminée."
echo ""
echo "Runner installé ici :"
echo "$RUNNER_HOME"
echo ""
echo "Application attendue ici :"
echo "$APP_DIR"
echo ""
echo "Script de déploiement :"
echo "$DEPLOY_BIN"
echo ""
echo "Vérifie le service avec :"
echo "sudo $RUNNER_HOME/svc.sh status"
echo ""
echo "Important : si Docker vient d'être installé, reconnecte-toi à ta session SSH pour que le groupe docker soit bien pris en compte."

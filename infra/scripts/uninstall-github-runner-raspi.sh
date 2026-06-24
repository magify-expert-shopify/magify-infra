#!/usr/bin/env bash
set -euo pipefail

# ============================================================
# Désinstallation GitHub Actions Runner
# Compatible avec une installation dans /home/admin/actions-runner
# ============================================================

TARGET_USER="${TARGET_USER:-${SUDO_USER:-$(id -un)}}"

if [[ "$TARGET_USER" == "root" ]]; then
  echo "Erreur : évite de cibler root."
  echo "Exemple : sudo ./uninstall-github-runner-raspi.sh"
  exit 1
fi

USER_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6)"

if [[ -z "$USER_HOME" || ! -d "$USER_HOME" ]]; then
  echo "Impossible de trouver le home de l'utilisateur : $TARGET_USER"
  exit 1
fi

RUNNER_HOME="${RUNNER_HOME:-$USER_HOME/actions-runner}"
APP_DIR="${APP_DIR:-$USER_HOME/myapp}"
DEPLOY_BIN="${DEPLOY_BIN:-$USER_HOME/bin/deploy-containers}"

# Token optionnel.
# Tu peux le récupérer dans GitHub :
# Settings > Actions > Runners > ton runner > Remove
RUNNER_TOKEN="${RUNNER_TOKEN:-}"

# Sécurité : par défaut on supprime le runner et le script de déploiement,
# mais on garde le dossier app pour ne pas effacer .env, docker-compose.yml, volumes, etc.
DELETE_RUNNER_DIR="${DELETE_RUNNER_DIR:-true}"
DELETE_DEPLOY_SCRIPT="${DELETE_DEPLOY_SCRIPT:-true}"
DELETE_APP_DIR="${DELETE_APP_DIR:-false}"

if [[ "$EUID" -ne 0 ]]; then
  echo "Lance ce script avec sudo."
  echo "Exemple : sudo ./uninstall-github-runner-raspi.sh"
  exit 1
fi

echo "Utilisateur cible       : $TARGET_USER"
echo "Home utilisateur        : $USER_HOME"
echo "Dossier runner          : $RUNNER_HOME"
echo "Dossier app             : $APP_DIR"
echo "Script déploiement      : $DEPLOY_BIN"
echo ""

if [[ ! -d "$RUNNER_HOME" ]]; then
  echo "Aucun dossier runner trouvé ici : $RUNNER_HOME"
  echo "Rien à désinstaller côté runner local."
else
  if [[ ! -f "$RUNNER_HOME/config.sh" && ! -f "$RUNNER_HOME/svc.sh" ]]; then
    echo "Le dossier existe, mais ne ressemble pas à un dossier actions-runner :"
    echo "$RUNNER_HOME"
    echo "Abandon pour éviter de supprimer n'importe quoi."
    exit 1
  fi

  cd "$RUNNER_HOME"

  echo "Arrêt du service runner si présent..."

  if [[ -f "./svc.sh" ]]; then
    ./svc.sh stop || true
    ./svc.sh uninstall || true
  fi

  systemctl daemon-reload || true

  if [[ -n "$RUNNER_TOKEN" ]]; then
    echo "Suppression du runner côté GitHub avec le token fourni..."

    if [[ -f "./config.sh" ]]; then
      sudo -u "$TARGET_USER" ./config.sh remove \
        --unattended \
        --token "$RUNNER_TOKEN" || {
          echo "La suppression côté GitHub a échoué."
          echo "Le nettoyage local va continuer."
        }
    else
      echo "config.sh introuvable, suppression GitHub ignorée."
    fi
  else
    echo "Aucun RUNNER_TOKEN fourni."
    echo "Le script va faire un nettoyage local uniquement."
    echo "Pense à supprimer le runner dans GitHub si nécessaire : Settings > Actions > Runners."
  fi

  cd "$USER_HOME"

  if [[ "$DELETE_RUNNER_DIR" == "true" ]]; then
    echo "Suppression du dossier runner : $RUNNER_HOME"
    rm -rf "$RUNNER_HOME"
  else
    echo "Conservation du dossier runner : $RUNNER_HOME"

    if [[ -f "$RUNNER_HOME/.runner" ]]; then
      echo "Suppression du fichier .runner pour permettre une future reconfiguration."
      rm -f "$RUNNER_HOME/.runner"
    fi
  fi
fi

if [[ "$DELETE_DEPLOY_SCRIPT" == "true" && -f "$DEPLOY_BIN" ]]; then
  echo "Suppression du script de déploiement : $DEPLOY_BIN"
  rm -f "$DEPLOY_BIN"
fi

if [[ "$DELETE_APP_DIR" == "true" && -d "$APP_DIR" ]]; then
  echo "Suppression du dossier app : $APP_DIR"
  rm -rf "$APP_DIR"
else
  if [[ -d "$APP_DIR" ]]; then
    echo "Dossier app conservé : $APP_DIR"
  fi
fi

echo ""
echo "Désinstallation terminée."
echo ""
echo "Docker n'a pas été supprimé."
echo "Tes containers Docker n'ont pas été arrêtés ni supprimés."
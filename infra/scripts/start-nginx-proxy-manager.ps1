param(
  [ValidateSet('prod', 'dev')]
  [string]$Instance = 'prod'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw "La commande 'docker' est requise mais introuvable."
}

$containerName = "magify-nginx-proxy-manager-$Instance"
$otherInstance = if ($Instance -eq 'prod') { 'dev' } else { 'prod' }
$otherContainerName = "magify-nginx-proxy-manager-$otherInstance"

$containerExists = docker ps -a --filter "name=^/${containerName}$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) {
  throw 'Impossible de consulter les conteneurs Docker.'
}

if ($containerExists -ne $containerName) {
  Write-Host "Conteneur introuvable: $containerName. Initialisation de l'instance $Instance..."
  $installer = Join-Path $PSScriptRoot 'install-nginx-proxy-manager.ps1'
  & $installer -Target Windows -Instance $Instance
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }
  return
}

$otherContainerRunning = docker ps --filter "name=^/${otherContainerName}$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) {
  throw 'Impossible de consulter les conteneurs Docker actifs.'
}

if ($otherContainerRunning -eq $otherContainerName) {
  Write-Host "Arret de l'instance incompatible: $otherContainerName"
  docker stop $otherContainerName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Impossible d'arreter le conteneur $otherContainerName."
  }
}

$containerRunning = docker ps --filter "name=^/${containerName}$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) {
  throw 'Impossible de consulter les conteneurs Docker actifs.'
}

if ($containerRunning -eq $containerName) {
  Write-Host "Nginx Proxy Manager $Instance est deja actif: $containerName"
} else {
  docker start $containerName | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "Impossible de demarrer le conteneur $containerName."
  }

  Write-Host "Nginx Proxy Manager $Instance demarre: $containerName"
}

Write-Host 'Interface: http://127.0.0.1:81'

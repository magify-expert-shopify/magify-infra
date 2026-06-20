param(
  [string]$RaspberryHost = '192.168.1.11',
  [string]$RaspberryUser = 'admin',
  [string]$RemoteRoot = '/home/admin/apps/magify-apps/infra'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$localDbDir = Join-Path $repoRoot 'infra\db'
$remoteDbDir = "$RemoteRoot/db"
$remoteComposeDir = "$RemoteRoot/compose"

$dbFiles = @(
  'blog.db',
  'prospection.db',
  'social.db'
)

$supportFiles = @(
  @{ Local = Join-Path $repoRoot 'infra\compose\.env.prod'; Remote = "$remoteComposeDir/.env.prod" },
  @{ Local = Join-Path $repoRoot 'infra\db\import.sh'; Remote = "$remoteDbDir/import.sh" },
  @{ Local = Join-Path $repoRoot 'infra\db\init\001-create-users-and-databases.sql'; Remote = "$remoteDbDir/init/001-create-users-and-databases.sql" }
)

Write-Host "Synchronisation des bases SQLite vers le Raspberry..."
ssh "$RaspberryUser@$RaspberryHost" "mkdir -p '$remoteDbDir'"
ssh "$RaspberryUser@$RaspberryHost" "mkdir -p '$remoteDbDir/init'"

foreach ($dbFile in $dbFiles) {
  $localPath = Join-Path $localDbDir $dbFile
  if (-not (Test-Path $localPath)) {
    Write-Host "Ignoré: $dbFile introuvable."
    continue
  }

  scp $localPath "$RaspberryUser@$RaspberryHost:$remoteDbDir/"
}

foreach ($item in $supportFiles) {
  if (-not (Test-Path $item.Local)) {
    throw "Fichier manquant: $($item.Local)"
  }

  scp $item.Local "$RaspberryUser@$RaspberryHost:$($item.Remote)"
}

Write-Host "Lancement de l'import dans le conteneur PostgreSQL du Raspberry..."
ssh "$RaspberryUser@$RaspberryHost" "cd '$remoteComposeDir' && docker compose --env-file .env.prod -f docker-compose.databases.yml run --rm magify-db-import"

Write-Host "Import terminé."

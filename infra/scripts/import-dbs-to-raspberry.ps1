param(
  [string]$RaspberryHost = '192.168.1.11',
  [string]$RaspberryUser = 'admin',
  [string]$RemoteRoot = '/home/admin/apps/magify-infra/infra',
  [string]$SshKeyPath = (Join-Path $PSScriptRoot '..\ssh\raspberry')
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

$resolvedKeyPath = (Resolve-Path $SshKeyPath).Path
$resolvedPubKeyPath = [System.IO.Path]::ChangeExtension($resolvedKeyPath, '.pub')
$publicKey = (Get-Content $resolvedPubKeyPath -Raw).Trim()

function Ensure-SshAgent {
  $agentService = Get-Service ssh-agent -ErrorAction Stop

  if ($agentService.StartType -eq 'Disabled') {
    try {
      Set-Service ssh-agent -StartupType Manual
    } catch {
      throw "Impossible d'activer ssh-agent. Lance PowerShell en administrateur une fois, puis réessaie. Détail: $($_.Exception.Message)"
    }
  }

  $agentService = Get-Service ssh-agent -ErrorAction Stop
  if ($agentService.Status -ne 'Running') {
    try {
      Start-Service ssh-agent
    } catch {
      throw "Impossible de démarrer ssh-agent. Lance PowerShell en administrateur une fois, puis réessaie. Détail: $($_.Exception.Message)"
    }
  }
}

function Ensure-KeyLoaded {
  $loadedKeys = & ssh-add -L 2>$null

  if ($LASTEXITCODE -eq 0 -and ($loadedKeys -join "`n") -match [regex]::Escape($publicKey)) {
    return
  }

  Write-Host "Chargement de la clé SSH dans ssh-agent: $resolvedKeyPath"
  & ssh-add $resolvedKeyPath

  if ($LASTEXITCODE -ne 0) {
    throw "Impossible de charger la clé SSH dans ssh-agent."
  }
}

Ensure-SshAgent
Ensure-KeyLoaded

$sshArgs = @(
  '-o',
  'IdentitiesOnly=yes'
)

Write-Host "Synchronisation des bases SQLite vers le Raspberry..."
ssh @sshArgs "$RaspberryUser@$RaspberryHost" "mkdir -p '$remoteDbDir'"
ssh @sshArgs "$RaspberryUser@$RaspberryHost" "mkdir -p '$remoteDbDir/init'"

foreach ($dbFile in $dbFiles) {
  $localPath = Join-Path $localDbDir $dbFile
  if (-not (Test-Path $localPath)) {
    Write-Host "Ignoré: $dbFile introuvable."
    continue
  }

  scp @sshArgs $localPath "${RaspberryUser}@${RaspberryHost}:$remoteDbDir/"
}

foreach ($item in $supportFiles) {
  if (-not (Test-Path $item.Local)) {
    throw "Fichier manquant: $($item.Local)"
  }

  scp @sshArgs $item.Local "${RaspberryUser}@${RaspberryHost}:$($item.Remote)"
}

Write-Host "Lancement de l'import dans le conteneur PostgreSQL du Raspberry..."
ssh @sshArgs "$RaspberryUser@$RaspberryHost" "cd '$remoteComposeDir' && docker compose --env-file .env.prod -f docker-compose.databases.yml run --rm magify-db-import"

Write-Host "Import terminé."

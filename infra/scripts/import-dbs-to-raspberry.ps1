param(
  [string]$RaspberryHost = $(if ($env:RASPBERRY_DB_HOST) { $env:RASPBERRY_DB_HOST } else { '192.168.1.11' }),
  [string]$RaspberryDbPort = $(if ($env:RASPBERRY_DB_PORT) { $env:RASPBERRY_DB_PORT } else { '5432' }),
  [string]$RaspberryDbUser = $env:RASPBERRY_DB_USER,
  [string]$RaspberryDbPassword = $env:RASPBERRY_DB_PASSWORD
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$localDbDir = Join-Path $repoRoot 'infra\db'
$loadDir = Join-Path $env:TEMP 'magify-pgloader-loads'
$pgloaderImage = 'dimitri/pgloader:latest'

$dbMappings = @(
  @{ File = 'blog.db'; Db = 'blog' },
  @{ File = 'prospection.db'; Db = 'prospection' },
  @{ File = 'social.db'; Db = 'social' }
)

function Invoke-DockerCommand {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Arguments
  )

  & docker @Arguments

  if ($LASTEXITCODE -ne 0) {
    throw "Commande Docker échouée: docker $($Arguments -join ' ')"
  }
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
  throw 'Docker n''est pas disponible dans cette session PowerShell.'
}

if (-not $RaspberryDbUser) {
  throw 'RASPBERRY_DB_USER doit être défini dans les variables d''environnement.'
}

if (-not $RaspberryDbPassword) {
  throw 'RASPBERRY_DB_PASSWORD doit être défini dans les variables d''environnement.'
}

New-Item -ItemType Directory -Force -Path $loadDir | Out-Null

foreach ($mapping in $dbMappings) {
  $sourcePath = Join-Path $localDbDir $mapping.File

  if (-not (Test-Path $sourcePath)) {
    Write-Host "Ignoré: $($mapping.File) introuvable."
    continue
  }

  $targetDb = $mapping.Db
  $targetUrl = "postgresql://${RaspberryDbUser}:${RaspberryDbPassword}@${RaspberryHost}:${RaspberryDbPort}/${targetDb}"
  $loadFilePath = Join-Path $loadDir "$targetDb.load"
  $loadFileContent = @"
LOAD DATABASE
     FROM sqlite:///db/$($mapping.File)
     INTO postgresql://${RaspberryDbUser}:${RaspberryDbPassword}@${RaspberryHost}:${RaspberryDbPort}/${targetDb}

 WITH include drop, create tables, create indexes, reset sequences, foreign keys

 EXCLUDING TABLE NAMES LIKE '%migrations%'
;
"@

  [System.IO.File]::WriteAllText(
    $loadFilePath,
    $loadFileContent,
    (New-Object System.Text.UTF8Encoding($false))
  )

  Write-Host "Import de $($mapping.File) vers $targetDb sur $RaspberryHost`:$RaspberryDbPort..."
  Invoke-DockerCommand @(
    'run',
    '--rm',
    '--platform',
    'linux/amd64',
    '--entrypoint',
    'pgloader',
    '-v',
    "${localDbDir}:/db:ro",
    '-v',
    "${loadDir}:/work:ro",
    $pgloaderImage,
    "/work/$targetDb.load"
  )
}

Write-Host 'Import terminé.'

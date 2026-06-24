param(
  [switch]$HostsOnly,
  [switch]$SkipHosts
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$appName = 'social-web'
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $SkipHosts) {
  & (Join-Path $repoRoot 'infra\scripts\set-windows-host.ps1') -HostName 'social.magify.local' -Address '127.0.0.1'
}
if ($HostsOnly) { return }

& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path (Join-Path $PSScriptRoot '.env.prod')
Set-Location $repoRoot

$dockerfile = Join-Path $PSScriptRoot 'Dockerfile.prod'
$imageName = "magify-${appName}:prod"
$containerName = "magify-$appName-prod"
$envFile = Join-Path $PSScriptRoot '.env.prod'
$port = [int]$env:PORT
$containerPort = 30000

$tempEnvFile = [System.IO.Path]::GetTempFileName()
try {
  $envLines = foreach ($rawLine in Get-Content -LiteralPath $envFile) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) {
      $rawLine
      continue
    }

    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 1) {
      $rawLine
      continue
    }

    $name = $line.Substring(0, $separatorIndex).Trim()
    $value = $line.Substring($separatorIndex + 1)

    if (
      $value.Length -ge 2 -and
      (
        ($value.StartsWith('"') -and $value.EndsWith('"')) -or
        ($value.StartsWith("'") -and $value.EndsWith("'"))
      )
    ) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    "$name=$value"
  }

  Set-Content -LiteralPath $tempEnvFile -Value $envLines -Encoding utf8

  docker build -f $dockerfile -t $imageName $repoRoot
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  $networkName = 'magify-network'
  $networkExists = docker network ls --filter "name=^${networkName}$" --format '{{.Name}}'
  if ($networkExists -ne $networkName) {
    docker network create $networkName | Out-Null
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }

  $existingContainer = docker ps -a --filter "name=^/$containerName$" --format "{{.Names}}"
  if ($existingContainer) {
    docker rm -f $containerName | Out-Null
  }

  $containerId = docker run -d `
    --name $containerName `
    --network $networkName `
    --env-file $tempEnvFile `
    -p "${port}:${containerPort}" `
    $imageName
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

  Write-Host "Container started: $containerName ($containerId)"
  docker logs --tail 20 $containerName
}
finally {
  Remove-Item -LiteralPath $tempEnvFile -Force -ErrorAction SilentlyContinue
}

param([switch]$HostsOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $repoRoot 'infra\scripts\set-windows-host.ps1') -HostName 'www.dev.magify.local' -Address '127.0.0.1'
if ($HostsOnly) { return }

$imageName = 'magify-dashboard:dev'
$containerName = 'magify-dashboard-dev'
$networkName = 'magify-network'

Set-Location $repoRoot

$networkExists = docker network ls --filter "name=^${networkName}$" --format '{{.Name}}'
if ($networkExists -ne $networkName) {
  docker network create $networkName | Out-Null
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

docker build -f (Join-Path $PSScriptRoot 'Dockerfile.prod') -t $imageName $repoRoot
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$existingContainer = docker ps -a --filter "name=^/$containerName$" --format '{{.Names}}'
if ($existingContainer) {
  docker rm -f $containerName | Out-Null
}

docker run -d `
  --name $containerName `
  --restart unless-stopped `
  --network $networkName `
  $imageName
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host 'Dashboard dev started on magify-network (magify-dashboard-dev:80)'

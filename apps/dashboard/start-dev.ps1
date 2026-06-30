param([switch]$HostsOnly)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $repoRoot 'infra\scripts\set-windows-host.ps1') -HostName 'www.dev.magify.duckdns.org' -Address '127.0.0.1'
if ($HostsOnly) { return }

$envFile = Join-Path $PSScriptRoot '.env.dev'
& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path $envFile

$imageName = 'magify-dashboard:dev'
$containerName = 'magify-dashboard-dev'
$networkName = 'magify-network'

Set-Location $repoRoot

$networkExists = docker network ls --filter "name=^${networkName}$" --format '{{.Name}}'
if ($networkExists -ne $networkName) {
  docker network create $networkName | Out-Null
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

docker build -f (Join-Path $PSScriptRoot 'Dockerfile.prod') `
  --build-arg NUXT_PUBLIC_DASHBOARD_BLOG_URL=$env:NUXT_PUBLIC_DASHBOARD_BLOG_URL `
  --build-arg NUXT_PUBLIC_DASHBOARD_PROSPECTION_URL=$env:NUXT_PUBLIC_DASHBOARD_PROSPECTION_URL `
  --build-arg NUXT_PUBLIC_DASHBOARD_SOCIAL_URL=$env:NUXT_PUBLIC_DASHBOARD_SOCIAL_URL `
  --build-arg NUXT_PUBLIC_DASHBOARD_PROXY_MANAGER_URL=$env:NUXT_PUBLIC_DASHBOARD_PROXY_MANAGER_URL `
  -t $imageName $repoRoot
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

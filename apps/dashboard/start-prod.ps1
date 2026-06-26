param(
  [ValidateSet('Windows', 'Raspberry')]
  [string]$Target = 'Windows',
  [switch]$HostsOnly,
  [string]$RaspberryHost = $(if ($env:RASPBERRY_HOST) { $env:RASPBERRY_HOST } else { '192.168.1.12' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$hostAddress = if ($Target -eq 'Windows') { '127.0.0.1' } else { $RaspberryHost }
& (Join-Path $repoRoot 'infra\scripts\set-windows-host.ps1') -HostName 'www.magify.local' -Address $hostAddress

if ($HostsOnly -or $Target -eq 'Raspberry') {
  if ($Target -eq 'Raspberry' -and -not $HostsOnly) {
    Write-Host "Target Raspberry: le fichier hosts a ete mis a jour; aucun conteneur local ne sera lance."
  }
  return
}

$envFile = Join-Path $PSScriptRoot '.env.prod'
& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path $envFile

$imageName = 'magify-dashboard:prod'
$containerName = 'magify-dashboard-prod'
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
  --build-arg NUXT_PUBLIC_DASHBOARD_BLOG_API_URL=$env:NUXT_PUBLIC_DASHBOARD_BLOG_API_URL `
  --build-arg NUXT_PUBLIC_DASHBOARD_PROSPECTION_API_URL=$env:NUXT_PUBLIC_DASHBOARD_PROSPECTION_API_URL `
  --build-arg NUXT_PUBLIC_DASHBOARD_SOCIAL_API_URL=$env:NUXT_PUBLIC_DASHBOARD_SOCIAL_API_URL `
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

Write-Host 'Dashboard prod started on magify-network (magify-dashboard-prod:80)'

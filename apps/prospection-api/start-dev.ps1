param(
  [switch]$HostsOnly,
  [string]$RaspberryHost = $(if ($env:RASPBERRY_HOST) { $env:RASPBERRY_HOST } else { '192.168.1.91' })
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $repoRoot 'infra\scripts\set-windows-host.ps1') -HostName 'prospection-api.magify.local' -Address $RaspberryHost
if ($HostsOnly) { return }

& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path (Join-Path $PSScriptRoot '.env.dev')
Set-Location $PSScriptRoot

pnpm run dev

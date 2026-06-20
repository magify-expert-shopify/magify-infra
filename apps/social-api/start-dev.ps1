$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path (Join-Path $PSScriptRoot '.env.dev')
Set-Location $PSScriptRoot

pnpm run dev

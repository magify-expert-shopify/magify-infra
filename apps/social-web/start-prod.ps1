$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
& (Join-Path $repoRoot 'infra\scripts\load-dotenv.ps1') -Path (Join-Path $PSScriptRoot '.env.prod')
Set-Location $PSScriptRoot

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run preview

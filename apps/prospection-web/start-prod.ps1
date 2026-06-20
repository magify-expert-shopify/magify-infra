$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'production'
$env:PORT = '3002'
$env:APP_URL = 'http://prospection.magify.local:3002'
$env:NUXT_PUBLIC_API_URL = 'http://prospection-api.magify.local:4002'

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run preview

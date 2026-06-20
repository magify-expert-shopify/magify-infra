$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'production'
$env:PORT = '3003'
$env:APP_URL = 'http://social.magify.local:3003'
$env:NUXT_PUBLIC_API_URL = 'http://social-api.magify.local:4003'

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run preview

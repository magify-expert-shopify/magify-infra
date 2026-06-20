$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'production'
$env:PORT = '3001'
$env:APP_URL = 'http://blog.magify.local:3001'
$env:NUXT_PUBLIC_API_URL = 'http://blog-api.magify.local:4001'

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run preview

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'production'
$env:PORT = '4002'
$env:APP_URL = 'http://prospection-api.magify.local:4002'
$env:POSTGRES_HOST = '192.168.1.11'
$env:POSTGRES_PORT = '5432'
$env:POSTGRES_USER = 'magify'
$env:POSTGRES_DB = 'prospection'
$env:POSTGRES_PASSWORD = 'brunstad'
$env:DATABASE_URL = "postgresql://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
$env:REDIS_URL = 'redis://192.168.1.11:6379'
$env:REDIS_HOST = '192.168.1.11'
$env:REDIS_PORT = '6379'
$env:CORS_ORIGINS = 'http://prospection.magify.local'
$env:NUXT_PUBLIC_WEB_URL = 'http://prospection.magify.local'

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run start:prod

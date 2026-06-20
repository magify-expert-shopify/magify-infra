$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'development'
$env:PORT = '4003'
$env:APP_URL = 'http://social-api.dev.magify.local:4003'
$env:POSTGRES_HOST = '192.168.1.11'
$env:POSTGRES_PORT = '5432'
$env:POSTGRES_USER = 'magify'
$env:POSTGRES_DB = 'social'
$env:POSTGRES_PASSWORD = 'brunstad'
$env:DATABASE_URL = "postgresql://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
$env:REDIS_URL = 'redis://192.168.1.11:6379'
$env:REDIS_HOST = '192.168.1.11'
$env:REDIS_PORT = '6379'
$env:CORS_ORIGINS = 'http://social.dev.magify.local'
$env:NUXT_PUBLIC_WEB_URL = 'http://social.dev.magify.local'

pnpm run dev

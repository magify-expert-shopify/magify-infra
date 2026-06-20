$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'development'
$env:PORT = '4001'
$env:APP_URL = 'http://blog-api.dev.magify.local:4001'
$env:POSTGRES_HOST = '192.168.1.11'
$env:POSTGRES_PORT = '5432'
$env:POSTGRES_USER = 'magify'
$env:POSTGRES_DB = 'magify'
$env:POSTGRES_PASSWORD = 'brunstad'
$env:DATABASE_URL = "postgresql://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
$env:REDIS_URL = 'redis://192.168.1.11:6379'
$env:REDIS_HOST = '192.168.1.11'
$env:REDIS_PORT = '6379'
$env:BULLMQ_HOST = $env:REDIS_HOST
$env:BULLMQ_PORT = $env:REDIS_PORT
$env:NUXT_WEB_URL = 'http://blog.dev.magify.local'
$env:WEB_URL = $env:NUXT_WEB_URL
$env:FRONTEND_URL = $env:NUXT_WEB_URL

pnpm run dev

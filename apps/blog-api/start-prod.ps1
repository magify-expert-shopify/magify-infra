$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'production'
$env:PORT = '4001'
$env:APP_URL = 'http://blog-api.magify.local:4001'
$env:POSTGRES_HOST = '192.168.1.11'
$env:POSTGRES_PORT = '5432'
$env:POSTGRES_ADMIN_USER = 'admin'
$env:POSTGRES_ADMIN_PASSWORD = 'brunstad'
$env:POSTGRES_APP_USER = 'magify'
$env:POSTGRES_APP_PASSWORD = 'brunstad'
$env:POSTGRES_DB = 'blog'
$env:POSTGRES_USER = $env:POSTGRES_APP_USER
$env:POSTGRES_PASSWORD = $env:POSTGRES_APP_PASSWORD
$env:DATABASE_URL = "postgresql://$($env:POSTGRES_USER):$($env:POSTGRES_PASSWORD)@$($env:POSTGRES_HOST):$($env:POSTGRES_PORT)/$($env:POSTGRES_DB)"
$env:REDIS_URL = 'redis://192.168.1.11:6379'
$env:REDIS_HOST = '192.168.1.11'
$env:REDIS_PORT = '6379'
$env:BULLMQ_HOST = $env:REDIS_HOST
$env:BULLMQ_PORT = $env:REDIS_PORT
$env:NUXT_WEB_URL = 'http://blog.magify.local'
$env:WEB_URL = $env:NUXT_WEB_URL
$env:FRONTEND_URL = $env:NUXT_WEB_URL
$env:SUPABASE_URL = 'https://dfbjmfcqulkhjvhbkdti.supabase.co'
$env:SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRmYmptZmNxdWxraGp2aGJrZHRpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MTIzMDIsImV4cCI6MjA5MDE4ODMwMn0.VHQF3iJLO6ynabcsi8GvZOddKOB7-mlHWM-ZVRGpyIU'

pnpm run build
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

pnpm run start:prod

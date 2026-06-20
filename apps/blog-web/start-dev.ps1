$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'development'
$env:PORT = '3001'
$env:APP_URL = 'http://blog.dev.magify.local:3001'
$env:NUXT_PUBLIC_API_URL = 'http://blog-api.dev.magify.local:4001'

pnpm run dev

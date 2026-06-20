$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'development'
$env:PORT = '3002'
$env:APP_URL = 'http://prospection.dev.magify.local:3002'
$env:NUXT_PUBLIC_API_URL = 'http://prospection-api.dev.magify.local:4002'

pnpm run dev

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
Set-Location $PSScriptRoot

$env:NODE_ENV = 'development'
$env:PORT = '3003'
$env:APP_URL = 'http://social.dev.magify.local:3003'
$env:NUXT_PUBLIC_API_URL = 'http://social-api.dev.magify.local:4003'

pnpm run dev

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$installer = Join-Path $PSScriptRoot 'install-nginx-proxy-manager.ps1'
& $installer -Target Windows -Instance dev @args
exit $LASTEXITCODE

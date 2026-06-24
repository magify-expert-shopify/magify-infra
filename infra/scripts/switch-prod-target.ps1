param(
  [Parameter(Mandatory)]
  [ValidateSet('Windows', 'Raspberry')]
  [string]$Target,

  [string]$RaspberryHost = $(if ($env:RASPBERRY_HOST) { $env:RASPBERRY_HOST } else { '192.168.1.91' }),
  [string]$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts",
  [switch]$NoElevation
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$defaultHostsPath = "$env:SystemRoot\System32\drivers\etc\hosts"
$isDefaultHostsFile = $HostsPath -eq $defaultHostsPath
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isDefaultHostsFile -and -not $isAdministrator -and -not $NoElevation) {
  Write-Host 'Droits administrateur requis. Ouverture de la demande UAC...'
  $arguments = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`"",
    '-Target', $Target,
    '-RaspberryHost', $RaspberryHost,
    '-HostsPath', "`"$HostsPath`"",
    '-NoElevation'
  )

  $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList $arguments
  if ($process.ExitCode -ne 0) {
    throw "Le changement de cible a echoue avec le code $($process.ExitCode)."
  }
  return
}

if ($isDefaultHostsFile -and -not $isAdministrator) {
  throw 'Ce script doit etre execute en administrateur pour modifier le fichier hosts.'
}

$targetAddress = if ($Target -eq 'Windows') { '127.0.0.1' } else { $RaspberryHost }
$domains = @(
  'www.magify.local',
  'admin.magify.local',
  'db.magify.local',
  'blog.magify.local',
  'social.magify.local',
  'prospection.magify.local',
  'blog-api.magify.local',
  'social-api.magify.local',
  'prospection-api.magify.local'
)

$hostUpdater = Join-Path $PSScriptRoot 'set-windows-host.ps1'
foreach ($domain in $domains) {
  & $hostUpdater `
    -HostName $domain `
    -Address $targetAddress `
    -HostsPath $HostsPath `
    -NoElevation `
    -SkipDnsFlush
}

if ($isDefaultHostsFile) {
  ipconfig /flushdns | Out-Null
}

Write-Host ''
Write-Host "Cible production active: $Target"
Write-Host "Adresse appliquee: $targetAddress"
Write-Host "Domaines mis a jour: $($domains.Count)"

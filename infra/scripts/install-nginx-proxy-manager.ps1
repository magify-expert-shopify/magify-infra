param(
  [ValidateSet('Windows', 'Raspberry')]
  [string]$Target = 'Windows',

  [string]$RaspberryHost = $(if ($env:RASPBERRY_HOST) { $env:RASPBERRY_HOST } else { '192.168.1.91' }),
  [string]$RaspberryUser = $(if ($env:RASPBERRY_USER) { $env:RASPBERRY_USER } else { 'admin' }),
  [string]$SshKeyPath,
  [ValidateSet('prod', 'dev')]
  [string]$Instance = 'prod',
  [switch]$SkipProxyConfiguration
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path

if ([string]::IsNullOrWhiteSpace($SshKeyPath)) {
  $SshKeyPath = Join-Path $repoRoot 'infra\ssh\raspberry'
}

$imageName = 'jc21/nginx-proxy-manager:latest'
$networkName = 'magify-network'
$dashboardPort = 81
$httpPort = 80
$httpsPort = 443
$timeZone = 'Europe/Bucharest'

$adminEmail = if ($env:NPM_ADMIN_EMAIL) { $env:NPM_ADMIN_EMAIL } else { 'admin@magify.com' }
$adminPassword = if ($env:NPM_ADMIN_PASSWORD) { $env:NPM_ADMIN_PASSWORD } else { 'brunstad' }
$fallbackAdminEmail = 'admin@example.com'
$fallbackAdminPassword = 'changeme'
$legacyAdminEmail = 'tomderudder@gmail.com'
$legacyAdminPassword = 'brunstad'

function Assert-Command {
  param([Parameter(Mandatory)][string]$Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "La commande '$Name' est requise mais introuvable."
  }
}

function Invoke-ExternalCommand {
  param(
    [Parameter(Mandatory)][string]$FilePath,
    [Parameter(Mandatory)][string[]]$Arguments
  )

  $commandOutput = & $FilePath @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Commande echouee ($LASTEXITCODE): $FilePath $($Arguments -join ' ')"
  }

  if ($commandOutput) {
    $commandOutput | ForEach-Object { Write-Host $_ }
  }
}

function Invoke-RaspberrySsh {
  param([Parameter(Mandatory)][string]$Command)

  Invoke-ExternalCommand -FilePath 'ssh' -Arguments @(
    '-i', $SshKeyPath,
    '-o', 'IdentitiesOnly=yes',
    "$RaspberryUser@$RaspberryHost",
    $Command
  )
}

function Invoke-RaspberryScp {
  param(
    [Parameter(Mandatory)][string]$LocalPath,
    [Parameter(Mandatory)][string]$RemotePath
  )

  Invoke-ExternalCommand -FilePath 'scp' -Arguments @(
    '-i', $SshKeyPath,
    '-o', 'IdentitiesOnly=yes',
    $LocalPath,
    "${RaspberryUser}@${RaspberryHost}:$RemotePath"
  )
}

function Start-WindowsProxyManager {
  Assert-Command -Name 'docker'

  $containerName = "magify-nginx-proxy-manager-$Instance"
  $backendContainerName = "magify-dashboard-$Instance"
  $baseDir = Join-Path $env:USERPROFILE $containerName
  $dataDir = Join-Path $baseDir 'data'
  $letsEncryptDir = Join-Path $baseDir 'letsencrypt'
  $defaultHostConfigPath = Join-Path $baseDir 'default-host.conf'

  New-Item -ItemType Directory -Force -Path $dataDir, $letsEncryptDir | Out-Null

  $defaultHostConfig = @"
server {
  listen 80 default_server;
  listen [::]:80 default_server;
  server_name _;

  resolver 127.0.0.11 valid=10s ipv6=off;
  set `$forward_scheme "http";
  set `$server "${backendContainerName}";
  set `$port "80";
  set `$magify_backend "http://${backendContainerName}:80";

  location / {
    proxy_set_header Host `$host;
    proxy_set_header X-Real-IP `$remote_addr;
    proxy_set_header X-Forwarded-For `$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto `$scheme;
    proxy_http_version 1.1;
    proxy_set_header Upgrade `$http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_pass `$magify_backend;
  }
}
"@
  [System.IO.File]::WriteAllText(
    $defaultHostConfigPath,
    $defaultHostConfig,
    [System.Text.UTF8Encoding]::new($false)
  )

  $networkExists = docker network ls --filter "name=^${networkName}$" --format '{{.Name}}'
  if ($networkExists -ne $networkName) {
    Invoke-ExternalCommand -FilePath 'docker' -Arguments @('network', 'create', $networkName)
  }

  $backendContainer = docker ps -a --filter "name=^/${backendContainerName}$" --format '{{.Names}}'
  if ($backendContainer -eq $backendContainerName) {
    $backendNetworks = docker inspect $backendContainerName --format '{{range $name, $_ := .NetworkSettings.Networks}}{{$name}} {{end}}'
    if (($backendNetworks -split '\s+') -notcontains $networkName) {
      Invoke-ExternalCommand -FilePath 'docker' -Arguments @('network', 'connect', $networkName, $backendContainerName)
    }
  } else {
    Write-Warning "Backend absent: $backendContainerName. La page par defaut retournera 502 tant que ce conteneur ne sera pas demarre."
  }

  # Les instances locales utilisent les memes ports et sont donc mutuellement exclusives.
  $otherInstance = if ($Instance -eq 'prod') { 'dev' } else { 'prod' }
  $otherContainerName = "magify-nginx-proxy-manager-$otherInstance"
  $otherContainer = docker ps -a --filter "name=^/${otherContainerName}$" --format '{{.Names}}'
  if ($otherContainer -eq $otherContainerName) {
    Write-Host "Suppression de l'instance locale incompatible: $otherContainerName"
    Invoke-ExternalCommand -FilePath 'docker' -Arguments @('rm', '-f', $otherContainerName)
  }

  $existingContainer = docker ps -a --filter "name=^/${containerName}$" --format '{{.Names}}'
  if ($existingContainer -eq $containerName) {
    Invoke-ExternalCommand -FilePath 'docker' -Arguments @('rm', '-f', $containerName)
  }

  Invoke-ExternalCommand -FilePath 'docker' -Arguments @(
    'run', '-d',
    '--name', $containerName,
    '--restart', 'unless-stopped',
    '--network', $networkName,
    '--add-host', 'host.docker.internal:host-gateway',
    '-p', "${httpPort}:80",
    '-p', "${dashboardPort}:81",
    '-p', "${httpsPort}:443",
    '-e', "TZ=$timeZone",
    '-v', "${dataDir}:/data",
    '-v', "${letsEncryptDir}:/etc/letsencrypt",
    '-v', "${defaultHostConfigPath}:/etc/nginx/conf.d/default.conf",
    $imageName
  )

  return @{
    ApiBaseUrl = "http://127.0.0.1:$dashboardPort"
    ContainerName = $containerName
    ProxyHosts = if ($Instance -eq 'dev') {
      @(
        @{ Name = 'www.dev.magify.duckdns.org'; ForwardHost = 'magify-dashboard-dev'; ForwardPort = 80 },
        @{ Name = 'admin.dev.magify.duckdns.org'; ForwardHost = $containerName; ForwardPort = 81 },
        @{ Name = 'db.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 5050 },
        @{ Name = 'blog.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3001 },
        @{ Name = 'blog-api.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 4001 },
        @{ Name = 'prospection.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3002 },
        @{ Name = 'prospection-api.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 4002 },
        @{ Name = 'social.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3003 },
        @{ Name = 'social-api.dev.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 4003 }
      )
    } else {
      @(
        @{ Name = 'www.magify.duckdns.org'; ForwardHost = 'magify-dashboard-prod'; ForwardPort = 80 },
        @{ Name = 'admin.magify.duckdns.org'; ForwardHost = $containerName; ForwardPort = 81 },
        @{ Name = 'blog.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3001 },
        @{ Name = 'blog-api.magify.duckdns.org'; ForwardHost = 'blog-api'; ForwardPort = 4001 },
        @{ Name = 'prospection.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3002 },
        @{ Name = 'prospection-api.magify.duckdns.org'; ForwardHost = 'magify-prospection-api-prod'; ForwardPort = 4002 },
        @{ Name = 'social.magify.duckdns.org'; ForwardHost = 'host.docker.internal'; ForwardPort = 3003 },
        @{ Name = 'social-api.magify.duckdns.org'; ForwardHost = 'magify-social-api-prod'; ForwardPort = 4003 }
      )
    }
  }
}

function Start-RaspberryProxyManager {
  Assert-Command -Name 'ssh'
  Assert-Command -Name 'scp'

  if (-not (Test-Path -LiteralPath $SshKeyPath -PathType Leaf)) {
    throw "Cle SSH introuvable: $SshKeyPath"
  }

  $containerName = 'magify-nginx-proxy-manager'
  $remoteBaseDir = "/home/$RaspberryUser/apps/magify-nginx-proxy-manager"
  $remoteComposeFile = "$remoteBaseDir/docker-compose.yml"
  $composeContent = @"
services:
  nginx-proxy-manager:
    image: $imageName
    container_name: $containerName
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    environment:
      TZ: $timeZone
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    networks:
      - $networkName

volumes:
  npm-data:
  npm-letsencrypt:

networks:
  ${networkName}:
    external: true
"@

  $tempComposeFile = Join-Path ([System.IO.Path]::GetTempPath()) "magify-npm-$([guid]::NewGuid().ToString('N')).yml"
  try {
    [System.IO.File]::WriteAllText(
      $tempComposeFile,
      $composeContent,
      [System.Text.UTF8Encoding]::new($false)
    )

    Invoke-RaspberrySsh -Command "mkdir -p '$remoteBaseDir'"
    Invoke-RaspberryScp -LocalPath $tempComposeFile -RemotePath $remoteComposeFile
    Invoke-RaspberrySsh -Command "docker network inspect $networkName >/dev/null 2>&1 || docker network create $networkName >/dev/null; docker compose -f '$remoteComposeFile' up -d"
  } finally {
    Remove-Item -LiteralPath $tempComposeFile -Force -ErrorAction SilentlyContinue
  }

  return @{
    ApiBaseUrl = "http://${RaspberryHost}:$dashboardPort"
    ContainerName = $containerName
    ProxyHosts = @(
      @{ Name = 'www.magify.duckdns.org'; ForwardHost = 'magify-dashboard'; ForwardPort = 80 },
      @{ Name = 'admin.magify.duckdns.org'; ForwardHost = $RaspberryHost; ForwardPort = 81 },
      @{ Name = 'blog.magify.duckdns.org'; ForwardHost = 'blog-web'; ForwardPort = 3000 },
      @{ Name = 'blog-api.magify.duckdns.org'; ForwardHost = 'blog-api'; ForwardPort = 3000 },
      @{ Name = 'prospection.magify.duckdns.org'; ForwardHost = 'prospection-web'; ForwardPort = 3000 },
      @{ Name = 'prospection-api.magify.duckdns.org'; ForwardHost = 'prospection-api'; ForwardPort = 3000 },
      @{ Name = 'social.magify.duckdns.org'; ForwardHost = 'social-web'; ForwardPort = 3000 },
      @{ Name = 'social-api.magify.duckdns.org'; ForwardHost = 'social-api'; ForwardPort = 3000 }
    )
  }
}

function Invoke-NpmRequest {
  param(
    [Parameter(Mandatory)][string]$ApiBaseUrl,
    [Parameter(Mandatory)][string]$Method,
    [Parameter(Mandatory)][string]$Path,
    [string]$Token,
    [object]$Body
  )

  $headers = @{}
  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $parameters = @{
    Uri = "$ApiBaseUrl$Path"
    Method = $Method
    Headers = $headers
    TimeoutSec = 30
  }

  if ($null -ne $Body) {
    $parameters.ContentType = 'application/json'
    $parameters.Body = $Body | ConvertTo-Json -Depth 10 -Compress
  }

  Invoke-RestMethod @parameters
}

function Wait-ForProxyManagerApi {
  param(
    [Parameter(Mandatory)][string]$ApiBaseUrl,
    [int]$TimeoutSeconds = 180
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $ApiBaseUrl -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
    }
  } while ((Get-Date) -lt $deadline)

  throw "Nginx Proxy Manager ne repond pas sur $ApiBaseUrl."
}

function Get-NpmToken {
  param(
    [Parameter(Mandatory)][string]$ApiBaseUrl,
    [Parameter(Mandatory)][string]$Email,
    [Parameter(Mandatory)][string]$Password
  )

  $response = Invoke-NpmRequest -ApiBaseUrl $ApiBaseUrl -Method POST -Path '/api/tokens' -Body @{
    identity = $Email
    secret = $Password
  }

  if ($response.token) { return [string]$response.token }
  if ($response.access_token) { return [string]$response.access_token }
  throw 'La reponse de connexion NPM ne contient pas de token.'
}

function Get-NpmProxyHosts {
  param(
    [Parameter(Mandatory)][string]$ApiBaseUrl,
    [Parameter(Mandatory)][string]$Token
  )

  $response = Invoke-NpmRequest -ApiBaseUrl $ApiBaseUrl -Method GET -Path '/api/nginx/proxy-hosts' -Token $Token
  $dataProperty = $response.PSObject.Properties['data']
  if ($dataProperty -and $null -ne $dataProperty.Value) {
    return @($dataProperty.Value)
  }
  return @($response)
}

function Set-NpmProxyHost {
  param(
    [Parameter(Mandatory)][string]$ApiBaseUrl,
    [Parameter(Mandatory)][string]$Token,
    [Parameter(Mandatory)][hashtable]$ProxyHost
  )

  $existing = Get-NpmProxyHosts -ApiBaseUrl $ApiBaseUrl -Token $Token | Where-Object {
    $_.domain_names -contains $ProxyHost.Name
  } | Select-Object -First 1

  $body = @{
    domain_names = @($ProxyHost.Name)
    forward_scheme = 'http'
    forward_host = $ProxyHost.ForwardHost
    forward_port = [int]$ProxyHost.ForwardPort
    access_list_id = 0
    certificate_id = 0
    ssl_forced = $false
    caching_enabled = $false
    block_exploits = $true
    allow_websocket_upgrade = $true
    advanced_config = ''
    enabled = $true
    meta = @{ letsencrypt_agree = $false; dns_challenge = $false }
  }

  if ($existing -and $existing.PSObject.Properties['id'] -and $existing.id) {
    Write-Host "Mise a jour: $($ProxyHost.Name) -> $($ProxyHost.ForwardHost):$($ProxyHost.ForwardPort)"
    Invoke-NpmRequest -ApiBaseUrl $ApiBaseUrl -Method PUT -Path "/api/nginx/proxy-hosts/$($existing.id)" -Token $Token -Body $body | Out-Null
  } else {
    Write-Host "Creation: $($ProxyHost.Name) -> $($ProxyHost.ForwardHost):$($ProxyHost.ForwardPort)"
    Invoke-NpmRequest -ApiBaseUrl $ApiBaseUrl -Method POST -Path '/api/nginx/proxy-hosts' -Token $Token -Body $body | Out-Null
  }
}

Write-Host "Installation de Nginx Proxy Manager - cible: $Target"

$installation = if ($Target -eq 'Windows') {
  Start-WindowsProxyManager
} else {
  Start-RaspberryProxyManager
}

Write-Host "Attente de Nginx Proxy Manager sur $($installation.ApiBaseUrl)..."
Wait-ForProxyManagerApi -ApiBaseUrl $installation.ApiBaseUrl

if (-not $SkipProxyConfiguration) {
  $token = $null
  foreach ($credentials in @(
    @{ Email = $adminEmail; Password = $adminPassword },
    @{ Email = $legacyAdminEmail; Password = $legacyAdminPassword },
    @{ Email = $fallbackAdminEmail; Password = $fallbackAdminPassword }
  )) {
    try {
      $token = Get-NpmToken -ApiBaseUrl $installation.ApiBaseUrl -Email $credentials.Email -Password $credentials.Password
      Write-Host "Connexion NPM reussie avec $($credentials.Email)."
      break
    } catch {
      continue
    }
  }

  if ($token) {
    foreach ($proxyHost in $installation.ProxyHosts) {
      Set-NpmProxyHost -ApiBaseUrl $installation.ApiBaseUrl -Token $token -ProxyHost $proxyHost
    }
  } else {
    Write-Warning "Le conteneur est demarre, mais les proxy hosts n'ont pas ete configures."
    Write-Warning "Termine l'initialisation sur $($installation.ApiBaseUrl), puis relance le script."
  }
}

Write-Host ''
Write-Host "Nginx Proxy Manager est pret sur $Target."
Write-Host "Conteneur: $($installation.ContainerName)"
Write-Host "Interface: $($installation.ApiBaseUrl)"

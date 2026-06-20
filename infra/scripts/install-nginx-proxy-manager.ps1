$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path
$sshKeyPath = Join-Path $repoRoot 'infra\ssh\raspberry'

$RaspberryHost = '192.168.1.91'
$RaspberryUser = 'admin'
$RemoteBaseDir = '/home/admin/apps/magify-nginx-proxy-manager'
$RemoteComposeFile = "$RemoteBaseDir/docker-compose.yml"
$ProxyManagerContainerName = 'magify-nginx-proxy-manager'
$ProxyManagerImage = 'jc21/nginx-proxy-manager:latest'
$ProxyManagerApiBaseUrl = "http://${RaspberryHost}:81"

$DesiredAdminEmail = 'admin@magify.com'
$DesiredAdminPassword = 'brunstad'
$FallbackAdminEmail = 'admin@example.com'
$FallbackAdminPassword = 'changeme'

$ProxyHosts = @(
  @{
    Name = 'www.magify.local'
    ForwardHost = 'blog-web'
    ForwardPort = 30000
  },
  @{
    Name = 'admin.magify.local'
    ForwardHost = $RaspberryHost
    ForwardPort = 81
  },
  @{
    Name = 'blog.magify.local'
    ForwardHost = 'blog-web'
    ForwardPort = 30000
  },
  @{
    Name = 'blog-api.magify.local'
    ForwardHost = 'blog-api'
    ForwardPort = 30000
  },
  @{
    Name = 'prospection.magify.local'
    ForwardHost = 'prospection-web'
    ForwardPort = 30000
  },
  @{
    Name = 'prospection-api.magify.local'
    ForwardHost = 'prospection-api'
    ForwardPort = 30000
  },
  @{
    Name = 'social.magify.local'
    ForwardHost = 'social-web'
    ForwardPort = 30000
  },
  @{
    Name = 'social-api.magify.local'
    ForwardHost = 'social-api'
    ForwardPort = 30000
  }
)

function Invoke-RaspberrySsh {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Command
  )

  & ssh -i $sshKeyPath -o IdentitiesOnly=yes "$RaspberryUser@$RaspberryHost" $Command

  if ($LASTEXITCODE -ne 0) {
    throw "Commande SSH échouée: ssh $RaspberryUser@$RaspberryHost $Command"
  }
}

function Invoke-RaspberryScp {
  param(
    [Parameter(Mandatory = $true)]
    [string]$LocalPath,
    [Parameter(Mandatory = $true)]
    [string]$RemotePath
  )

  & scp -i $sshKeyPath -o IdentitiesOnly=yes $LocalPath "${RaspberryUser}@${RaspberryHost}:$RemotePath"

  if ($LASTEXITCODE -ne 0) {
    throw "Copie SCP échouée: $LocalPath -> $RemotePath"
  }
}

function Wait-ForProxyManagerApi {
  param(
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $ProxyManagerApiBaseUrl -Method Get -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
      continue
    }

    Start-Sleep -Seconds 3
  }

  throw "Nginx Proxy Manager n'a pas répondu sur $ProxyManagerApiBaseUrl dans le délai imparti."
}

function ConvertTo-ProxyManagerBody {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$ProxyHost
  )

  @{
    domain_names = @($ProxyHost.Name)
    forward_scheme = 'http'
    forward_host = $ProxyHost.ForwardHost
    forward_port = [int]$ProxyHost.ForwardPort
    access_list_id = 0
    certificate_id = 0
    ssl_forced = $false
    caching_enabled = $false
    block_exploits = $true
    advanced_config = ''
    meta = @{
      letsencrypt_agree = $false
      dns_challenge = $false
    }
    allow_websocket_upgrade = $true
    http2_support = $false
    forward_host_header = 'preserve'
    preserve_path = $false
    enabled = $true
  }
}

function Invoke-NpmRequest {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Method,
    [Parameter(Mandatory = $true)]
    [string]$Path,
    [string]$Token,
    [object]$Body
  )

  $headers = @{}

  if ($Token) {
    $headers.Authorization = "Bearer $Token"
  }

  $invokeParams = @{
    Uri = "$ProxyManagerApiBaseUrl$Path"
    Method = $Method
    Headers = $headers
    TimeoutSec = 30
  }

  if ($null -ne $Body) {
    $invokeParams.ContentType = 'application/json'
    $invokeParams.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  return Invoke-RestMethod @invokeParams
}

function Get-NpmToken {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Email,
    [Parameter(Mandatory = $true)]
    [string]$Password
  )

  $response = Invoke-NpmRequest -Method 'POST' -Path '/api/tokens' -Body @{
    identity = $Email
    secret = $Password
  }

  if ($response.token) {
    return [string]$response.token
  }

  if ($response.access_token) {
    return [string]$response.access_token
  }

  throw 'La réponse de connexion NPM ne contient pas de token.'
}

function Get-NpmProxyHosts {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token
  )

  try {
    $response = Invoke-NpmRequest -Method 'GET' -Path '/api/nginx/proxy-hosts' -Token $Token
    if ($response.data) {
      return @($response.data)
    }

    if ($response -is [System.Array]) {
      return @($response)
    }
  } catch {
    return @()
  }

  return @()
}

function Upsert-NpmProxyHost {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token,
    [Parameter(Mandatory = $true)]
    [hashtable]$ProxyHost
  )

  $desiredDomain = $ProxyHost.Name.Trim()
  $existing = Get-NpmProxyHosts -Token $Token | Where-Object {
    $_.domain_names -and ($_.domain_names -contains $desiredDomain)
  } | Select-Object -First 1

  $body = ConvertTo-ProxyManagerBody -ProxyHost $ProxyHost

  if ($existing -and $existing.id) {
    Write-Host "Mise à jour du proxy: $desiredDomain"
    Invoke-NpmRequest -Method 'PUT' -Path "/api/nginx/proxy-hosts/$($existing.id)" -Token $Token -Body $body | Out-Null
    return
  }

  Write-Host "Création du proxy: $desiredDomain"
  Invoke-NpmRequest -Method 'POST' -Path '/api/nginx/proxy-hosts' -Token $Token -Body $body | Out-Null
}

Write-Host "Préparation de Nginx Proxy Manager sur le Raspberry..."
Write-Host "SSH key: $sshKeyPath"

$composeContent = @"
services:
  nginx-proxy-manager:
    image: $ProxyManagerImage
    container_name: $ProxyManagerContainerName
    restart: unless-stopped
    ports:
      - "80:80"
      - "81:81"
      - "443:443"
    environment:
      TZ: Europe/Bucharest
    volumes:
      - npm-data:/data
      - npm-letsencrypt:/etc/letsencrypt
    networks:
      - magify-network

volumes:
  npm-data:
  npm-letsencrypt:

networks:
  magify-network:
    external: true
"@

$tempComposeFile = Join-Path $env:TEMP 'magify-nginx-proxy-manager-docker-compose.yml'
[System.IO.File]::WriteAllText(
  $tempComposeFile,
  $composeContent,
  (New-Object System.Text.UTF8Encoding($false))
)

Invoke-RaspberrySsh "mkdir -p '$RemoteBaseDir'"
Invoke-RaspberryScp -LocalPath $tempComposeFile -RemotePath $RemoteComposeFile

Invoke-RaspberrySsh @"
if ! docker network inspect magify-network >/dev/null 2>&1; then
  docker network create magify-network >/dev/null
fi
docker rm -f $ProxyManagerContainerName >/dev/null 2>&1 || true
docker compose -f $RemoteComposeFile up -d
"@

Write-Host "Attente de l'API NPM sur $ProxyManagerApiBaseUrl..."
Wait-ForProxyManagerApi

$token = $null
$candidateCredentials = @(
  @{ Email = $DesiredAdminEmail; Password = $DesiredAdminPassword },
  @{ Email = $FallbackAdminEmail; Password = $FallbackAdminPassword }
)

foreach ($candidate in $candidateCredentials) {
  try {
    $token = Get-NpmToken -Email $candidate.Email -Password $candidate.Password
    Write-Host "Connexion NPM réussie avec $($candidate.Email)"
    break
  } catch {
    continue
  }
}

if (-not $token) {
  throw "Impossible de se connecter à Nginx Proxy Manager. Vérifie le compte admin ou ouvre l'interface une première fois."
}

foreach ($proxyHost in $ProxyHosts) {
  Upsert-NpmProxyHost -Token $token -ProxyHost $proxyHost
}

Write-Host ""
Write-Host "Nginx Proxy Manager est prêt."
Write-Host "Dashboard: http://${RaspberryHost}:81"
Write-Host "Compte essayé: $DesiredAdminEmail / $DesiredAdminPassword"
Write-Host "Si le compte n'existait pas, l'alternative par défaut a été tentée: $FallbackAdminEmail / $FallbackAdminPassword"

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = (Resolve-Path (Join-Path $scriptDir '..\..')).Path

$ContainerName = 'magify-nginx-proxy-manager-dev'
$ImageName = 'jc21/nginx-proxy-manager:latest'
$DashboardPort = 81
$HttpPort = 80
$HttpsPort = 443
$BaseDir = Join-Path $env:USERPROFILE 'magify-nginx-proxy-manager-dev'
$DataDir = Join-Path $BaseDir 'data'
$LetsEncryptDir = Join-Path $BaseDir 'letsencrypt'

$DefaultAdminEmail = $env:NPM_ADMIN_EMAIL
if ([string]::IsNullOrWhiteSpace($DefaultAdminEmail)) {
  $DefaultAdminEmail = 'tomderudder@gmail.com'
}

$DefaultAdminPassword = $env:NPM_ADMIN_PASSWORD
if ([string]::IsNullOrWhiteSpace($DefaultAdminPassword)) {
  $DefaultAdminPassword = 'brunstad'
}

$ProxyHosts = @(
  @{
    Name = 'www.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 3001
  },
  @{
    Name = 'admin.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 4001
  },
  @{
    Name = 'db.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 5050
  },
  @{
    Name = 'blog.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 3001
  },
  @{
    Name = 'blog-api.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 4001
  },
  @{
    Name = 'prospection.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 3002
  },
  @{
    Name = 'prospection-api.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 4002
  },
  @{
    Name = 'social.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 3003
  },
  @{
    Name = 'social-api.dev.magify.local'
    ForwardHost = 'host.docker.internal'
    ForwardPort = 4003
  }
)

New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path $LetsEncryptDir | Out-Null

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

  $params = @{
    Uri = "http://127.0.0.1:$DashboardPort$Path"
    Method = $Method
    Headers = $headers
    TimeoutSec = 30
  }

  if ($null -ne $Body) {
    $params.ContentType = 'application/json'
    $params.Body = ($Body | ConvertTo-Json -Depth 10 -Compress)
  }

  Invoke-RestMethod @params
}

function Wait-ForProxyManagerApi {
  param(
    [int]$TimeoutSeconds = 120
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri "http://127.0.0.1:$DashboardPort" -Method Get -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Seconds 3
      continue
    }

    Start-Sleep -Seconds 3
  }

  throw "Nginx Proxy Manager n'a pas répondu sur http://127.0.0.1:$DashboardPort dans le délai imparti."
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

function Get-ProxyManagerBodies {
  param(
    [Parameter(Mandatory = $true)]
    [hashtable]$ProxyHost
  )

  @(
    @{
      domain_names = @($ProxyHost.Name)
      forward_scheme = 'http'
      forward_host = $ProxyHost.ForwardHost
      forward_port = [int]$ProxyHost.ForwardPort
      access_list_id = 0
      certificate_id = 0
      ssl_forced = $false
      advanced_config = ''
    },
    @{
      domain_names = @($ProxyHost.Name)
      forward_scheme = 'http'
      forward_host = $ProxyHost.ForwardHost
      forward_port = [int]$ProxyHost.ForwardPort
      access_list_id = 0
      certificate_id = 0
      ssl_forced = $false
      advanced_config = ''
      enabled = $true
    },
    @{
      domain_names = @($ProxyHost.Name)
      forward_scheme = 'http'
      forward_host = $ProxyHost.ForwardHost
      forward_port = [int]$ProxyHost.ForwardPort
      access_list_id = 0
      certificate_id = 0
      ssl_forced = $false
      advanced_config = ''
      caching_enabled = $false
      block_exploits = $true
      allow_websocket_upgrade = $true
      enabled = $true
    }
  )
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

  if ($existing -and $existing.id) {
    Write-Host "Mise à jour du proxy: $desiredDomain"
    foreach ($body in (Get-ProxyManagerBodies -ProxyHost $ProxyHost)) {
      try {
        Invoke-NpmRequest -Method 'PUT' -Path "/api/nginx/proxy-hosts/$($existing.id)" -Token $Token -Body $body | Out-Null
        return
      } catch {
        continue
      }
    }
    throw "Impossible de mettre à jour le proxy $desiredDomain"
  }

  Write-Host "Création du proxy: $desiredDomain"
  foreach ($body in (Get-ProxyManagerBodies -ProxyHost $ProxyHost)) {
    try {
      Invoke-NpmRequest -Method 'POST' -Path '/api/nginx/proxy-hosts' -Token $Token -Body $body | Out-Null
      return
    } catch {
      continue
    }
  }

  throw "Impossible de créer le proxy $desiredDomain"
}

Write-Host 'Préparation de Nginx Proxy Manager sur Windows...'
Write-Host "Dossier de données: $BaseDir"

docker container inspect $ContainerName *> $null
if ($LASTEXITCODE -eq 0) {
  docker rm -f $ContainerName | Out-Null
}

docker run -d `
  --name $ContainerName `
  -p "${HttpPort}:80" `
  -p "${DashboardPort}:81" `
  -p "${HttpsPort}:443" `
  -e TZ='Europe/Bucharest' `
  -v "${DataDir}:/data" `
  -v "${LetsEncryptDir}:/etc/letsencrypt" `
  --restart unless-stopped `
  $ImageName | Out-Null

Write-Host "Attente de l'API NPM..."
Wait-ForProxyManagerApi

$token = $null
$credentialsToTry = @(
  @{ Email = $DefaultAdminEmail; Password = $DefaultAdminPassword }
)

foreach ($credentials in $credentialsToTry) {
  try {
    $token = Get-NpmToken -Email $credentials.Email -Password $credentials.Password
    Write-Host "Connexion NPM réussie avec $($credentials.Email)"
    break
  } catch {
    continue
  }
}

if (-not $token) {
  Write-Warning 'Impossible de se connecter à Nginx Proxy Manager via /api/tokens.'
  Write-Warning 'Si c''est le premier démarrage, ouvre http://localhost:81 et termine le wizard initial, puis relance ce script.'
  Write-Warning "Identifiants testés: $DefaultAdminEmail / $DefaultAdminPassword"
  exit 0
}

foreach ($proxyHost in $ProxyHosts) {
  Upsert-NpmProxyHost -Token $token -ProxyHost $proxyHost
}

Write-Host ''
Write-Host 'Nginx Proxy Manager est prêt sur Windows.'
Write-Host "Dashboard: http://localhost:$DashboardPort"
Write-Host "Identifiants par défaut: $DefaultAdminEmail / $DefaultAdminPassword"

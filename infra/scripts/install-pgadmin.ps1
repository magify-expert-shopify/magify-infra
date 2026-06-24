# install-pgadmin.ps1

$RaspberryHost = "192.168.1.11"
$RaspberryDbPort = "5432"
$RaspberryDbName = "postgres"
$RaspberryDbUser = "magify"
$RaspberryDbPassword = "brunstad"
$PgAdminHost = "db.dev.magify.local"
$PgAdminPort = "5050"

$PgAdminEmail = "admin@magify.com"
$PgAdminPassword = "brunstad"

$BaseDir = "$env:USERPROFILE\pgadmin-docker"
$ServersJson = "$BaseDir\servers.json"
$PgPassFile = "$BaseDir\pgpass"
$PgAdminVolume = "pgadmin-data"
$NetworkName = "magify-network"

New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null

$serversJsonContent = @"
{
  "Servers": {
    "1": {
      "Name": "Raspberry PostgreSQL",
      "Group": "Servers",
      "Host": "$RaspberryHost",
      "Port": $RaspberryDbPort,
      "MaintenanceDB": "$RaspberryDbName",
      "Username": "$RaspberryDbUser",
      "PassFile": "/pgpass",
      "SSLMode": "prefer",
      "Favorite": true
    }
  }
}
"@
[System.IO.File]::WriteAllText(
  $ServersJson,
  $serversJsonContent,
  (New-Object System.Text.UTF8Encoding($false))
)
$pgPassContent = "$RaspberryHost`:$RaspberryDbPort`:$RaspberryDbName`:$RaspberryDbUser`:$RaspberryDbPassword"
[System.IO.File]::WriteAllText($PgPassFile, $pgPassContent, [System.Text.Encoding]::ASCII)

docker rm -f pgadmin 2>$null
docker volume rm -f $PgAdminVolume 2>$null

$networkExists = docker network ls --filter "name=^${NetworkName}$" --format '{{.Name}}'
if ($networkExists -ne $NetworkName) {
  docker network create $NetworkName | Out-Null
}

docker run -d `
  --name pgadmin `
  --network $NetworkName `
  -p "${PgAdminPort}:80" `
  -e PGADMIN_DEFAULT_EMAIL="$PgAdminEmail" `
  -e PGADMIN_DEFAULT_PASSWORD="$PgAdminPassword" `
  -e PGADMIN_CONFIG_SERVER_MODE=False `
  -e PGADMIN_REPLACE_SERVERS_ON_STARTUP=True `
  -e PGADMIN_SERVER_JSON_FILE="/pgadmin4/servers.json" `
  -v "${ServersJson}:/pgadmin4/servers.json" `
  -v "${PgPassFile}:/pgpass" `
  -v "${PgAdminVolume}:/var/lib/pgadmin" `
  --restart unless-stopped `
  dpage/pgadmin4:latest

Write-Host ""
Write-Host "pgAdmin est lancé : http://$PgAdminHost`:$PgAdminPort"
Write-Host "Login pgAdmin : $PgAdminEmail"
Write-Host "Mot de passe pgAdmin : $PgAdminPassword"
Write-Host "Connexion PostgreSQL : $RaspberryDbUser@$RaspberryHost`:$RaspberryDbPort / $RaspberryDbName"

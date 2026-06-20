# install-pgadmin.ps1

$RaspberryHost = "192.168.1.11"
$RaspberryDbPort = "5432"
$RaspberryDbName = "postgres"
$RaspberryDbUser = "admin"
$RaspberryDbPassword = "brunstad"

$PgAdminEmail = "admin@magify.local"
$PgAdminPassword = "brunstad"

$BaseDir = "$env:USERPROFILE\pgadmin-docker"
$ServersJson = "$BaseDir\servers.json"
$PgPassFile = "$BaseDir\pgpass"

New-Item -ItemType Directory -Force -Path $BaseDir | Out-Null

@"
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
"@ | Set-Content -Encoding UTF8 $ServersJson

"$RaspberryHost`:$RaspberryDbPort`:$RaspberryDbName`:$RaspberryDbUser`:$RaspberryDbPassword" | Set-Content -Encoding ASCII $PgPassFile

docker rm -f pgadmin 2>$null

docker run -d `
  --name pgadmin `
  -p 5050:80 `
  -e PGADMIN_DEFAULT_EMAIL="$PgAdminEmail" `
  -e PGADMIN_DEFAULT_PASSWORD="$PgAdminPassword" `
  -e PGADMIN_CONFIG_SERVER_MODE=False `
  -e PGADMIN_SERVER_JSON_FILE="/pgadmin4/servers.json" `
  -v "${ServersJson}:/pgadmin4/servers.json" `
  -v "${PgPassFile}:/pgpass" `
  -v "pgadmin-data:/var/lib/pgadmin" `
  --restart unless-stopped `
  dpage/pgadmin4:latest

Write-Host ""
Write-Host "pgAdmin est lancé : http://localhost:5050"
Write-Host "Login pgAdmin : $PgAdminEmail"
Write-Host "Mot de passe pgAdmin : $PgAdminPassword"
Write-Host "Connexion PostgreSQL : $RaspberryDbUser@$RaspberryHost`:$RaspberryDbPort / $RaspberryDbName"

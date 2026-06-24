param(
  [Parameter(Mandatory)]
  [ValidatePattern('^[a-zA-Z0-9.-]+$')]
  [string]$HostName,

  [Parameter(Mandatory)]
  [string]$Address,

  [string]$HostsPath = "$env:SystemRoot\System32\drivers\etc\hosts",
  [switch]$NoElevation,
  [switch]$SkipDnsFlush
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$parsedAddress = $null
if (-not [System.Net.IPAddress]::TryParse($Address, [ref]$parsedAddress)) {
  throw "Adresse IP invalide: $Address"
}

$isDefaultHostsFile = $HostsPath -eq "$env:SystemRoot\System32\drivers\etc\hosts"
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = [Security.Principal.WindowsPrincipal]::new($identity)
$isAdministrator = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if ($isDefaultHostsFile -and -not $isAdministrator -and -not $NoElevation) {
  Write-Host "Droits administrateur requis pour modifier $HostsPath."
  $process = Start-Process -FilePath 'powershell.exe' -Verb RunAs -Wait -PassThru -ArgumentList @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$PSCommandPath`"",
    '-HostName', $HostName,
    '-Address', $Address,
    '-HostsPath', "`"$HostsPath`"",
    '-NoElevation'
  )

  if ($process.ExitCode -ne 0) {
    throw "La mise à jour du fichier hosts a échoué avec le code $($process.ExitCode)."
  }

  return
}

if ($isDefaultHostsFile -and -not $isAdministrator) {
  throw "Le script doit être exécuté en administrateur pour modifier $HostsPath."
}

$result = [System.Collections.Generic.List[string]]::new()
foreach ($line in [System.IO.File]::ReadAllLines($HostsPath)) {
  $commentIndex = $line.IndexOf('#')
  $content = if ($commentIndex -ge 0) { $line.Substring(0, $commentIndex) } else { $line }
  $comment = if ($commentIndex -ge 0) { $line.Substring($commentIndex) } else { '' }
  $tokens = @($content -split '\s+' | Where-Object { $_ })

  if ($tokens.Count -ge 2 -and $tokens[1..($tokens.Count - 1)] -contains $HostName) {
    $remainingHosts = @($tokens[1..($tokens.Count - 1)] | Where-Object { $_ -ne $HostName })
    if ($remainingHosts.Count -gt 0) {
      $preservedLine = "$($tokens[0])`t$($remainingHosts -join ' ')"
      if ($comment) { $preservedLine += " $comment" }
      $result.Add($preservedLine)
    } elseif ($comment -and $comment -notmatch '^#\s*magify:') {
      $result.Add($comment)
    }
    continue
  }

  $result.Add($line)
}

$normalizedResult = [System.Collections.Generic.List[string]]::new()
foreach ($line in $result) {
  $isBlank = [string]::IsNullOrWhiteSpace($line)
  if ($isBlank) {
    continue
  }
  $normalizedResult.Add($line)
}
$result = $normalizedResult

while ($result.Count -gt 0 -and [string]::IsNullOrWhiteSpace($result[$result.Count - 1])) {
  $result.RemoveAt($result.Count - 1)
}

$result.Add("$Address`t$HostName`t# magify: managed by start scripts")

$tempFile = Join-Path ([System.IO.Path]::GetTempPath()) "magify-hosts-$([guid]::NewGuid().ToString('N'))"
try {
  [System.IO.File]::WriteAllLines($tempFile, $result, [System.Text.UTF8Encoding]::new($false))
  Copy-Item -LiteralPath $tempFile -Destination $HostsPath -Force
} finally {
  Remove-Item -LiteralPath $tempFile -Force -ErrorAction SilentlyContinue
}

if (-not $SkipDnsFlush) {
  ipconfig /flushdns | Out-Null
}
Write-Host "Hosts: $HostName -> $Address"

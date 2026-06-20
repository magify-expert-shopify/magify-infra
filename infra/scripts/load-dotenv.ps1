param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if (-not (Test-Path -LiteralPath $Path)) {
  throw "Fichier .env introuvable: $Path"
}

foreach ($rawLine in Get-Content -LiteralPath $Path) {
  $line = $rawLine.Trim()

  if (-not $line -or $line.StartsWith('#')) {
    continue
  }

  $separatorIndex = $line.IndexOf('=')
  if ($separatorIndex -lt 1) {
    continue
  }

  $name = $line.Substring(0, $separatorIndex).Trim()
  $value = $line.Substring($separatorIndex + 1)

  if (
    $value.Length -ge 2 -and
    (
      ($value.StartsWith('"') -and $value.EndsWith('"')) -or
      ($value.StartsWith("'") -and $value.EndsWith("'"))
    )
  ) {
    $value = $value.Substring(1, $value.Length - 2)
  }

  Set-Item -Path "Env:$name" -Value $value
}

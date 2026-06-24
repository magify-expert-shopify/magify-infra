[CmdletBinding()]
param(
    [switch]$RefreshLockfile,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

function Invoke-CheckedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$Command,
        [Parameter(ValueFromRemainingArguments)]
        [string[]]$Arguments
    )

    & $Command @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "La commande '$Command $($Arguments -join ' ')' a echoue (code $LASTEXITCODE)."
    }
}

Write-Host '1/5 - Validation des package.json'
$packageFiles = @(
    Get-Item -LiteralPath (Join-Path $repoRoot 'package.json')
    foreach ($workspaceFolder in @('apps', 'packages')) {
        $workspacePath = Join-Path $repoRoot $workspaceFolder
        if (-not (Test-Path -LiteralPath $workspacePath)) { continue }

        Get-ChildItem -LiteralPath $workspacePath -Directory -Force | ForEach-Object {
            $manifestPath = Join-Path $_.FullName 'package.json'
            if (Test-Path -LiteralPath $manifestPath) {
                Get-Item -LiteralPath $manifestPath
            }
        }
    }
)

if ($packageFiles.Count -eq 0) {
    throw 'Aucun package.json trouve.'
}

$packageNames = @{}
foreach ($packageFile in $packageFiles) {
    try {
        $manifest = Get-Content -LiteralPath $packageFile.FullName -Raw | ConvertFrom-Json
    }
    catch {
        throw "JSON invalide dans '$($packageFile.FullName)': $($_.Exception.Message)"
    }

    if ([string]::IsNullOrWhiteSpace([string]$manifest.name)) {
        throw "Le champ 'name' est absent ou vide dans '$($packageFile.FullName)'."
    }

    if ($packageNames.ContainsKey($manifest.name)) {
        throw "Nom de package duplique '$($manifest.name)' dans '$($packageNames[$manifest.name])' et '$($packageFile.FullName)'."
    }
    $packageNames[$manifest.name] = $packageFile.FullName

    foreach ($section in @('dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies')) {
        $sectionProperty = $manifest.PSObject.Properties[$section]
        if ($null -eq $sectionProperty) { continue }
        $dependencies = $sectionProperty.Value

        foreach ($dependency in $dependencies.PSObject.Properties) {
            if ([string]::IsNullOrWhiteSpace([string]$dependency.Value)) {
                throw "Version vide pour '$($dependency.Name)' ($section) dans '$($packageFile.FullName)'."
            }
        }
    }
}

$rootManifest = Get-Content -LiteralPath (Join-Path $repoRoot 'package.json') -Raw | ConvertFrom-Json
if (-not $rootManifest.private) {
    throw "Le package.json racine doit contenir 'private: true' pour ce monorepo."
}
if ([string]$rootManifest.packageManager -notmatch '^pnpm@') {
    throw "Le package.json racine doit declarer 'packageManager: pnpm@<version>'."
}
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'pnpm-workspace.yaml'))) {
    throw 'pnpm-workspace.yaml est absent.'
}
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'pnpm-lock.yaml'))) {
    throw 'pnpm-lock.yaml est absent. Utilisez -RefreshLockfile pour en creer un nouveau.'
}

$foreignLockfiles = @(
    Get-ChildItem -Path $repoRoot -File -Recurse -Force |
        Where-Object {
            $_.Name -in @('package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock') -and
            $_.FullName -notmatch '[\\/]node_modules[\\/]'
        }
)
if ($foreignLockfiles.Count -gt 0) {
    $list = ($foreignLockfiles.FullName -join [Environment]::NewLine)
    throw "Lockfiles incompatibles avec pnpm detectes :$([Environment]::NewLine)$list"
}

if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    throw "pnpm est introuvable. Installez Corepack/PNPM avant de relancer le script."
}

Write-Host '2/5 - Verification de la version de pnpm'
$expectedPnpmVersion = ([string]$rootManifest.packageManager).Substring('pnpm@'.Length)
$actualPnpmVersion = (& pnpm --version).Trim()
if ($LASTEXITCODE -ne 0) {
    throw 'Impossible de lire la version de pnpm.'
}
if ($actualPnpmVersion -ne $expectedPnpmVersion) {
    throw "Version pnpm incorrecte : $actualPnpmVersion installee, $expectedPnpmVersion attendue. Executez 'corepack prepare pnpm@$expectedPnpmVersion --activate'."
}

Write-Host '3/5 - Suppression de tous les node_modules'
$nodeModulesDirectories = @(
    Get-ChildItem -Path $repoRoot -Directory -Filter node_modules -Recurse -Force -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length }
)
$topLevelNodeModules = [System.Collections.Generic.List[System.IO.DirectoryInfo]]::new()
foreach ($directory in $nodeModulesDirectories) {
    $isNested = $false
    foreach ($parent in $topLevelNodeModules) {
        if ($directory.FullName.StartsWith($parent.FullName + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) {
            $isNested = $true
            break
        }
    }
    if (-not $isNested) {
        $topLevelNodeModules.Add($directory)
    }
}

foreach ($directory in $topLevelNodeModules) {
    if (Test-Path -LiteralPath $directory.FullName) {
        Write-Host "Suppression: $($directory.FullName)"
        Remove-Item -LiteralPath $directory.FullName -Recurse -Force
    }
}

Write-Host '4/5 - Installation des dependances'
if ($RefreshLockfile) {
    Invoke-CheckedCommand pnpm install --no-frozen-lockfile
}
else {
    Invoke-CheckedCommand pnpm install --frozen-lockfile
}

if ($SkipBuild) {
    Write-Host '5/5 - Build ignore (-SkipBuild)'
}
else {
    Write-Host '5/5 - Verification du build de tous les workspaces'
    Invoke-CheckedCommand pnpm run build
}

Write-Host 'Reinstallation et verification terminees.' -ForegroundColor Green

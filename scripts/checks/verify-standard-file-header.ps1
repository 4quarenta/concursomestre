<#
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
#>

param(
    [switch]$IncludeBackend = $true
)

$ErrorActionPreference = 'Stop'

function Test-HasStandardHeader {
    param(
        [string]$Content
    )

    return $Content -match '@author:\s*4quarenta' -and $Content -match '@since 1\.0\.0'
}

function Get-FrontendTargets {
    param(
        [string]$Root
    )

    $targets = @(
        (Join-Path $Root 'App.tsx')
        (Join-Path $Root 'index.tsx')
        (Join-Path $Root 'vite.config.ts')
    ) | Where-Object { Test-Path $_ }

    $sourceFiles = Get-ChildItem -Path (Join-Path $Root 'src') -Recurse -File -Include *.ts, *.tsx, *.js, *.jsx |
        Select-Object -ExpandProperty FullName

    return ($targets + $sourceFiles) | Sort-Object -Unique
}

function Get-BackendTargets {
    param(
        [string]$Root
    )

    $roots = @(
        (Join-Path $Root 'api')
        (Join-Path $Root 'config')
        (Join-Path $Root 'modules')
        (Join-Path $Root 'shared')
        (Join-Path $Root 'scripts')
        (Join-Path $Root 'tests')
        (Join-Path $Root 'index.php')
        (Join-Path $Root 'router.php')
    ) | Where-Object { Test-Path $_ }

    $files = foreach ($item in $roots) {
        $resolved = Get-Item -LiteralPath $item
        if ($resolved.PSIsContainer) {
            Get-ChildItem -Path $resolved.FullName -Recurse -File -Include *.php | Select-Object -ExpandProperty FullName
        } else {
            $resolved.FullName
        }
    }

    return $files | Sort-Object -Unique
}

$frontendRoot = Split-Path -Parent $PSScriptRoot | Split-Path -Parent
$backendRoot = 'C:\xampp\htdocs\questao-pro-backend'

$targets = @()
$targets += Get-FrontendTargets -Root $frontendRoot

if ($IncludeBackend) {
    $targets += Get-BackendTargets -Root $backendRoot
}

$targets = $targets | Sort-Object -Unique
$missing = @()

foreach ($target in $targets) {
    $content = Get-Content -LiteralPath $target -Raw
    if (-not (Test-HasStandardHeader -Content $content)) {
        $missing += $target
    }
}

if ($missing.Count -gt 0) {
    $missing | ForEach-Object { Write-Output ("STANDARD_HEADER_MISSING|{0}" -f $_) }
    exit 1
}

Write-Output ("STANDARD_HEADER_VERIFY|OK|{0}" -f $targets.Count)

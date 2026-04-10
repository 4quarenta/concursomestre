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

$headerLines = @(
    '/*'
    '* ----------------------------------------------------'
    '* @author: 4quarenta'
    '* @author URI: https://github.com/4quarenta'
    '* @copyright: (c) 2026 ConcursoMestre. All rights reserved'
    '* ----------------------------------------------------'
    '*'
    '* @since 1.0.0'
    '*'
    '*/'
)

$headerBlock = ($headerLines -join "`r`n")

function Test-HasStandardHeader {
    param(
        [string]$Content
    )

    return $Content -match '@author:\s*4quarenta'
}

function Add-HeaderToScriptFile {
    param(
        [string]$Path
    )

    $content = Get-Content -LiteralPath $Path -Raw
    if (Test-HasStandardHeader -Content $content) {
        return $false
    }

    $trimmedStart = $content.TrimStart()

    if ($trimmedStart.StartsWith('<?php')) {
        $updated = [regex]::Replace(
            $content,
            '^\s*<\?php\s*',
            "<?php`r`n`r`n$headerBlock`r`n`r`n",
            1
        )
    } else {
        $updated = "$headerBlock`r`n`r`n$content"
    }

    [System.IO.File]::WriteAllText($Path, $updated, [System.Text.UTF8Encoding]::new($false))
    return $true
}

function Get-FrontendTargets {
    param(
        [string]$Root
    )

    $targets = @(
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
$updatedCount = 0

foreach ($target in $targets) {
    if (Add-HeaderToScriptFile -Path $target) {
        $updatedCount++
    }
}

Write-Output ("STANDARD_HEADER|UPDATED|{0}|TOTAL|{1}" -f $updatedCount, $targets.Count)

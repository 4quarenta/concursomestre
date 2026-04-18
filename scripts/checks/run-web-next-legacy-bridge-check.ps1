param(
    [string]$WebNextBaseUrl = 'http://localhost:3001',
    [string]$LegacyWebBaseUrl = 'http://localhost:3000',
    [string]$OutputPath = 'docs/reports/web-next-legacy-bridge-check-latest.json'
)

$ErrorActionPreference = 'Stop'

function Get-SummaryReportPath {
    param(
        [string]$JsonPath
    )

    $directory = Split-Path -Parent $JsonPath
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($JsonPath)
    $summaryFileName = "$baseName.summary.md"

    if ($directory) {
        return Join-Path $directory $summaryFileName
    }

    return $summaryFileName
}

$previousWebNextBaseUrl = $env:WEB_NEXT_BASE_URL
$previousLegacyBaseUrl = $env:WEB_LEGACY_BASE_URL
$previousOutputPath = $env:WEB_NEXT_LEGACY_BRIDGE_CHECK_OUTPUT

$env:WEB_NEXT_BASE_URL = $WebNextBaseUrl
$env:WEB_LEGACY_BASE_URL = $LegacyWebBaseUrl
$env:WEB_NEXT_LEGACY_BRIDGE_CHECK_OUTPUT = $OutputPath

try {
    npm run web-next:legacy-bridge-check
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    $summaryPath = Get-SummaryReportPath -JsonPath $OutputPath
    node scripts/checks/render-web-next-gate-summary.mjs $OutputPath | Set-Content -LiteralPath $summaryPath -Encoding utf8

    Write-Host "[OK] legacy bridge summary - $summaryPath"
}
finally {
    if ($null -eq $previousWebNextBaseUrl) {
        Remove-Item Env:WEB_NEXT_BASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:WEB_NEXT_BASE_URL = $previousWebNextBaseUrl
    }

    if ($null -eq $previousLegacyBaseUrl) {
        Remove-Item Env:WEB_LEGACY_BASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:WEB_LEGACY_BASE_URL = $previousLegacyBaseUrl
    }

    if ($null -eq $previousOutputPath) {
        Remove-Item Env:WEB_NEXT_LEGACY_BRIDGE_CHECK_OUTPUT -ErrorAction SilentlyContinue
    }
    else {
        $env:WEB_NEXT_LEGACY_BRIDGE_CHECK_OUTPUT = $previousOutputPath
    }
}

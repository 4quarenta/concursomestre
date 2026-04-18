param(
    [string]$WebNextBaseUrl = 'http://localhost:3001',
    [string]$LegacyWebBaseUrl = 'http://localhost:3000',
    [string]$ExpectedCanonicalBaseUrl = '',
    [string]$OutputPath = 'docs/reports/web-next-hybrid-local-latest.json',
    [string]$CutoverOutputPath = 'docs/reports/web-next-cutover-local.json',
    [string]$LegacyBridgeOutputPath = 'docs/reports/web-next-legacy-bridge-check-local.json',
    [switch]$RequireEntityIds,
    [string]$QuestionId = '',
    [string]$RankingId = '',
    [string]$MaterialId = ''
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )

    & powershell -ExecutionPolicy Bypass -File $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
}

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

$cutoverArguments = @(
    '-BaseUrl', $WebNextBaseUrl,
    '-OutputPath', $CutoverOutputPath
)

if ($ExpectedCanonicalBaseUrl) {
    $cutoverArguments += @('-ExpectedCanonicalBaseUrl', $ExpectedCanonicalBaseUrl)
}

if ($RequireEntityIds) {
    $cutoverArguments += '-RequireEntityIds'
}

if ($QuestionId) {
    $cutoverArguments += @('-QuestionId', $QuestionId)
}

if ($RankingId) {
    $cutoverArguments += @('-RankingId', $RankingId)
}

if ($MaterialId) {
    $cutoverArguments += @('-MaterialId', $MaterialId)
}

Invoke-Step -FilePath 'scripts/checks/run-web-next-cutover-report.ps1' -Arguments $cutoverArguments

$cutoverSummaryPath = Get-SummaryReportPath -JsonPath $CutoverOutputPath
node scripts/checks/render-web-next-gate-summary.mjs $CutoverOutputPath | Set-Content -LiteralPath $cutoverSummaryPath -Encoding utf8

$legacyBridgeArguments = @(
    '-WebNextBaseUrl', $WebNextBaseUrl,
    '-LegacyWebBaseUrl', $LegacyWebBaseUrl,
    '-OutputPath', $LegacyBridgeOutputPath
)

Invoke-Step -FilePath 'scripts/checks/run-web-next-legacy-bridge-check.ps1' -Arguments $legacyBridgeArguments

$legacyBridgeSummaryPath = Get-SummaryReportPath -JsonPath $LegacyBridgeOutputPath
node scripts/checks/render-web-next-gate-summary.mjs $LegacyBridgeOutputPath | Set-Content -LiteralPath $legacyBridgeSummaryPath -Encoding utf8

$cutoverReport = Get-Content -LiteralPath $CutoverOutputPath -Raw | ConvertFrom-Json
$legacyBridgeReport = Get-Content -LiteralPath $LegacyBridgeOutputPath -Raw | ConvertFrom-Json

$cutoverPassed = $false
if ($null -ne $cutoverReport.passed) {
    $cutoverPassed = [bool]$cutoverReport.passed
}
else {
    $cutoverPassed = [int]$cutoverReport.summary.fail -eq 0
}

$legacyBridgePassed = [int]$legacyBridgeReport.summary.failures -eq 0

$combinedSummary = [ordered]@{
    passed = $cutoverPassed -and $legacyBridgePassed
    cutover = [ordered]@{
        passed = $cutoverPassed
        ok = [int]$cutoverReport.summary.ok
        skip = [int]$cutoverReport.summary.skip
        fail = [int]$cutoverReport.summary.fail
    }
    legacyBridge = [ordered]@{
        passed = $legacyBridgePassed
        ok = [int]$legacyBridgeReport.summary.ok
        fail = [int]$legacyBridgeReport.summary.failures
        total = [int]$legacyBridgeReport.summary.total
    }
}

$combinedReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    webNextBaseUrl = $WebNextBaseUrl
    legacyWebBaseUrl = $LegacyWebBaseUrl
    expectedCanonicalBaseUrl = $ExpectedCanonicalBaseUrl
    requireEntityIds = [bool]$RequireEntityIds
    summary = $combinedSummary
    reports = [ordered]@{
        cutover = $cutoverReport
        legacyBridge = $legacyBridgeReport
    }
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$combinedReport | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

$combinedSummaryPath = Get-SummaryReportPath -JsonPath $OutputPath
node scripts/checks/render-web-next-gate-summary.mjs $OutputPath | Set-Content -LiteralPath $combinedSummaryPath -Encoding utf8

Write-Host "[OK] hybrid local report - $OutputPath"
Write-Host "[OK] hybrid local summary - $combinedSummaryPath"

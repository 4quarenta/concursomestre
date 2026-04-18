param(
    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',
    [string]$ConfigPath = '',
    [string]$BaseUrl,
    [string]$LegacyWebBaseUrl = '',
    [string]$ExpectedCanonicalBaseUrl,
    [string]$QuestionId,
    [string]$RankingId,
    [string]$MaterialId,
    [string]$OutputPath = '',
    [string]$CutoverOutputPath = '',
    [string]$LegacyBridgeOutputPath = ''
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

function Get-DetailedReportPath {
    param(
        [string]$CombinedPath,
        [string]$Suffix
    )

    $directory = Split-Path -Parent $CombinedPath
    $extension = [System.IO.Path]::GetExtension($CombinedPath)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($CombinedPath)

    if (-not $extension) {
        $extension = '.json'
    }

    $fileName = "$baseName.$Suffix$extension"

    if ($directory) {
        return Join-Path $directory $fileName
    }

    return $fileName
}

function Get-SummaryReportPath {
    param(
        [string]$JsonPath
    )

    $directory = Split-Path -Parent $JsonPath
    $extension = [System.IO.Path]::GetExtension($JsonPath)
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($JsonPath)

    if (-not $extension) {
        $extension = '.json'
    }

    $summaryFileName = "$baseName.summary.md"

    if ($directory) {
        return Join-Path $directory $summaryFileName
    }

    return $summaryFileName
}

if (-not $OutputPath) {
    $OutputPath = if ($Environment -eq 'production') {
        'docs/reports/web-next-production-gate.json'
    } else {
        'docs/reports/web-next-staging-gate.json'
    }
}

if (-not $ConfigPath) {
    $defaultLocalConfigPath = Join-Path 'config\deploy' "web-next-$Environment-gate.local.json"
    if (Test-Path -LiteralPath $defaultLocalConfigPath) {
        $ConfigPath = $defaultLocalConfigPath
    }
}

if ($ConfigPath) {
    $resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path
    $config = Get-Content -LiteralPath $resolvedConfigPath -Raw | ConvertFrom-Json

    if (-not $BaseUrl) {
        $BaseUrl = [string]$config.BaseUrl
    }

    if (-not $ExpectedCanonicalBaseUrl) {
        $ExpectedCanonicalBaseUrl = [string]$config.ExpectedCanonicalBaseUrl
    }

    if (-not $LegacyWebBaseUrl) {
        $LegacyWebBaseUrl = [string]$config.LegacyWebBaseUrl
    }

    if (-not $QuestionId) {
        $QuestionId = [string]$config.QuestionId
    }

    if (-not $RankingId) {
        $RankingId = [string]$config.RankingId
    }

    if (-not $MaterialId) {
        $MaterialId = [string]$config.MaterialId
    }

    if (($Environment -eq 'staging' -and $OutputPath -eq 'docs/reports/web-next-staging-gate.json') -or ($Environment -eq 'production' -and $OutputPath -eq 'docs/reports/web-next-production-gate.json')) {
        if ($config.OutputPath) {
            $OutputPath = [string]$config.OutputPath
        }
    }
}

$missing = @()

if (-not $BaseUrl) {
    $missing += 'BaseUrl'
}

if (-not $ExpectedCanonicalBaseUrl) {
    $missing += 'ExpectedCanonicalBaseUrl'
}

if (-not $QuestionId) {
    $missing += 'QuestionId'
}

if (-not $RankingId) {
    $missing += 'RankingId'
}

if (-not $MaterialId) {
    $missing += 'MaterialId'
}

if ($missing.Count -gt 0) {
    throw "Missing required staging gate values: $($missing -join ', ')"
}

if ($BaseUrl -match 'exemplo\.com' -or $ExpectedCanonicalBaseUrl -match 'exemplo\.com') {
    throw 'Replace placeholder staging gate hosts before running the validation.'
}

if ($LegacyWebBaseUrl -and $LegacyWebBaseUrl -match 'exemplo\.com') {
    throw 'Replace placeholder legacy web host before running the validation.'
}

$cutoverOutput = if ($LegacyWebBaseUrl) {
    if ($CutoverOutputPath) {
        $CutoverOutputPath
    }
    else {
        Get-DetailedReportPath -CombinedPath $OutputPath -Suffix 'public'
    }
}
else {
    $OutputPath
}

$cutoverArguments = @(
    '-BaseUrl', $BaseUrl,
    '-ExpectedCanonicalBaseUrl', $ExpectedCanonicalBaseUrl,
    '-RequireEntityIds',
    '-QuestionId', $QuestionId,
    '-RankingId', $RankingId,
    '-MaterialId', $MaterialId,
    '-OutputPath', $cutoverOutput
)

Invoke-Step -FilePath 'scripts/checks/run-web-next-cutover-report.ps1' -Arguments $cutoverArguments

$cutoverSummaryPath = Get-SummaryReportPath -JsonPath $cutoverOutput
node scripts/checks/render-web-next-gate-summary.mjs $cutoverOutput | Set-Content -LiteralPath $cutoverSummaryPath -Encoding utf8

if (-not $LegacyWebBaseUrl) {
    Write-Host "[OK] environment gate summary - $cutoverSummaryPath"
    return
}

$legacyBridgeOutput = if ($LegacyBridgeOutputPath) {
    $LegacyBridgeOutputPath
}
else {
    Get-DetailedReportPath -CombinedPath $OutputPath -Suffix 'legacy'
}

$legacyBridgeArguments = @(
    '-WebNextBaseUrl', $BaseUrl,
    '-LegacyWebBaseUrl', $LegacyWebBaseUrl,
    '-OutputPath', $legacyBridgeOutput
)

Invoke-Step -FilePath 'scripts/checks/run-web-next-legacy-bridge-check.ps1' -Arguments $legacyBridgeArguments

$legacyBridgeSummaryPath = Get-SummaryReportPath -JsonPath $legacyBridgeOutput
node scripts/checks/render-web-next-gate-summary.mjs $legacyBridgeOutput | Set-Content -LiteralPath $legacyBridgeSummaryPath -Encoding utf8

$cutoverReport = Get-Content -LiteralPath $cutoverOutput -Raw | ConvertFrom-Json
$legacyBridgeReport = Get-Content -LiteralPath $legacyBridgeOutput -Raw | ConvertFrom-Json

$cutoverPassed = $false
if ($null -ne $cutoverReport.passed) {
    $cutoverPassed = [bool]$cutoverReport.passed
}
else {
    $cutoverPassed = [int]$cutoverReport.summary.fail -eq 0
}

$legacyBridgePassed = [int]$legacyBridgeReport.summary.failures -eq 0

$combinedReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    environment = $Environment
    webNextBaseUrl = $BaseUrl
    legacyWebBaseUrl = $LegacyWebBaseUrl
    expectedCanonicalBaseUrl = $ExpectedCanonicalBaseUrl
    requireEntityIds = $true
    summary = [ordered]@{
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

Write-Host "[OK] hybrid environment gate - $OutputPath"
Write-Host "[OK] hybrid environment summary - $combinedSummaryPath"

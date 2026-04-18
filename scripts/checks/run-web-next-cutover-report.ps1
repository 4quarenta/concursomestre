param(
    [string]$BaseUrl = 'http://localhost:3001',
    [string]$OutputPath = 'docs/reports/web-next-cutover-latest.json',
    [string]$ExpectedCanonicalBaseUrl = '',
    [switch]$RequireEntityIds,
    [string]$QuestionId = '',
    [string]$RankingId = '',
    [string]$MaterialId = ''
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

$env:WEB_NEXT_BASE_URL = $BaseUrl
$env:WEB_NEXT_CHECK_OUTPUT = $OutputPath

if ($ExpectedCanonicalBaseUrl) {
    $env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL = $ExpectedCanonicalBaseUrl
} else {
    Remove-Item Env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL -ErrorAction SilentlyContinue
}

if ($RequireEntityIds) {
    $env:WEB_NEXT_REQUIRE_ENTITY_IDS = '1'
} else {
    Remove-Item Env:WEB_NEXT_REQUIRE_ENTITY_IDS -ErrorAction SilentlyContinue
}

if ($QuestionId) {
    $env:WEB_NEXT_CHECK_QUESTION_ID = $QuestionId
} else {
    Remove-Item Env:WEB_NEXT_CHECK_QUESTION_ID -ErrorAction SilentlyContinue
}

if ($RankingId) {
    $env:WEB_NEXT_CHECK_RANKING_ID = $RankingId
} else {
    Remove-Item Env:WEB_NEXT_CHECK_RANKING_ID -ErrorAction SilentlyContinue
}

if ($MaterialId) {
    $env:WEB_NEXT_CHECK_MATERIAL_ID = $MaterialId
} else {
    Remove-Item Env:WEB_NEXT_CHECK_MATERIAL_ID -ErrorAction SilentlyContinue
}

node scripts/checks/web-next-cutover-check.mjs

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$summaryPath = Get-SummaryReportPath -JsonPath $OutputPath
node scripts/checks/render-web-next-gate-summary.mjs $OutputPath | Set-Content -LiteralPath $summaryPath -Encoding utf8

Write-Host "[OK] cutover summary - $summaryPath"

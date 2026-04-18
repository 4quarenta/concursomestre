param(
    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',
    [string]$OutputPath = '',
    [string]$BaseUrl,
    [string]$LegacyWebBaseUrl = '',
    [string]$ExpectedCanonicalBaseUrl = '',
    [string]$QuestionId,
    [string]$RankingId,
    [string]$MaterialId,
    [ValidateSet('hybrid', 'next-only')]
    [string]$ProxyMode = 'hybrid',
    [string]$ProxyConfigReference = 'docs/examples/nginx-web-next-cutover.conf',
    [string]$WorkflowRunUrl = '',
    [string]$Notes = '',
    [switch]$Force
)

$ErrorActionPreference = 'Stop'

function Assert-RequiredValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if (-not $Value) {
        throw "Missing required stage 4 config value: $Name"
    }
}

function Assert-NotPlaceholder {
    param(
        [string]$Name,
        [string]$Value
    )

    if ($Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com') {
        throw "Replace placeholder value before creating stage 4 config: $Name"
    }

    if ($Value -in @('123', 'abc', 'xyz')) {
        throw "Replace sample entity ID before creating stage 4 config: $Name"
    }
}

if (-not $ExpectedCanonicalBaseUrl) {
    $ExpectedCanonicalBaseUrl = $BaseUrl
}

Assert-RequiredValue -Name 'BaseUrl' -Value $BaseUrl
Assert-RequiredValue -Name 'ExpectedCanonicalBaseUrl' -Value $ExpectedCanonicalBaseUrl
Assert-RequiredValue -Name 'QuestionId' -Value $QuestionId
Assert-RequiredValue -Name 'RankingId' -Value $RankingId
Assert-RequiredValue -Name 'MaterialId' -Value $MaterialId

Assert-NotPlaceholder -Name 'BaseUrl' -Value $BaseUrl
Assert-NotPlaceholder -Name 'ExpectedCanonicalBaseUrl' -Value $ExpectedCanonicalBaseUrl
Assert-NotPlaceholder -Name 'QuestionId' -Value $QuestionId
Assert-NotPlaceholder -Name 'RankingId' -Value $RankingId
Assert-NotPlaceholder -Name 'MaterialId' -Value $MaterialId

if ($LegacyWebBaseUrl) {
    Assert-NotPlaceholder -Name 'LegacyWebBaseUrl' -Value $LegacyWebBaseUrl
}

if ($ProxyMode -eq 'hybrid' -and -not $LegacyWebBaseUrl) {
    throw 'ProxyMode is hybrid, but LegacyWebBaseUrl is missing.'
}

if ($ProxyMode -eq 'next-only' -and $LegacyWebBaseUrl) {
    throw 'ProxyMode is next-only, but LegacyWebBaseUrl was provided.'
}

if ($ProxyConfigReference -and $ProxyConfigReference -notmatch '^https?://') {
    if (-not (Test-Path -LiteralPath $ProxyConfigReference)) {
        throw "ProxyConfigReference was not found: $ProxyConfigReference"
    }
}

if (-not $OutputPath) {
    $OutputPath = Join-Path 'config\deploy' "web-next-$Environment-rollout.local.json"
}

if ((Test-Path -LiteralPath $OutputPath) -and -not $Force) {
    throw "Stage 4 config already exists: $OutputPath. Re-run with -Force to replace it."
}

$gateOutputPath = if ($Environment -eq 'production') {
    'docs/reports/web-next-production-gate.json'
}
else {
    'docs/reports/web-next-staging-gate.json'
}

$rolloutOutputPath = if ($Environment -eq 'production') {
    'docs/reports/web-next-stage4-production-rollout-latest.json'
}
else {
    'docs/reports/web-next-stage4-rollout-latest.json'
}

$config = [ordered]@{
    Environment = $Environment
    BaseUrl = $BaseUrl
    LegacyWebBaseUrl = $LegacyWebBaseUrl
    ExpectedCanonicalBaseUrl = $ExpectedCanonicalBaseUrl
    QuestionId = $QuestionId
    RankingId = $RankingId
    MaterialId = $MaterialId
    ProxyMode = $ProxyMode
    ProxyConfigReference = $ProxyConfigReference
    GateOutputPath = $gateOutputPath
    OutputPath = $rolloutOutputPath
    GateCommand = 'npm run web-next:stage4-rollout'
    GateWorkflow = '.github/workflows/web-next-stage4-rollout.yml'
    WorkflowRunUrl = $WorkflowRunUrl
    Result = 'pending'
    Notes = $Notes
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding utf8

Write-Host "[OK] stage 4 rollout config - $OutputPath"
Write-Host "[NEXT] npm run web-next:stage4-config-check -- -ConfigPath $OutputPath"

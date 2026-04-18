param(
    [string]$OutputPath = '',
    [string]$BaseUrl,
    [string]$LegacyWebBaseUrl = '',
    [string]$ExpectedCanonicalBaseUrl = '',
    [string]$QuestionId,
    [string]$RankingId,
    [string]$MaterialId,
    [string]$SearchConsoleProperty,
    [string[]]$SitemapUrls = @(),
    [string[]]$InspectedUrls = @(),
    [bool]$SearchConsoleChecklistCompleted = $false,
    [int]$MonitoringWindowDays = 7,
    [string]$MonitoringNotes = '',
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
        throw "Missing required stage 5 config value: $Name"
    }
}

function Assert-NotPlaceholder {
    param(
        [string]$Name,
        [string]$Value
    )

    if ($Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com' -or $Value -match 'producao\.exemplo\.com') {
        throw "Replace placeholder value before creating stage 5 config: $Name"
    }

    if ($Value -in @('123', 'abc', 'xyz')) {
        throw "Replace sample entity ID before creating stage 5 config: $Name"
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
Assert-RequiredValue -Name 'SearchConsoleProperty' -Value $SearchConsoleProperty

Assert-NotPlaceholder -Name 'BaseUrl' -Value $BaseUrl
Assert-NotPlaceholder -Name 'ExpectedCanonicalBaseUrl' -Value $ExpectedCanonicalBaseUrl
Assert-NotPlaceholder -Name 'QuestionId' -Value $QuestionId
Assert-NotPlaceholder -Name 'RankingId' -Value $RankingId
Assert-NotPlaceholder -Name 'MaterialId' -Value $MaterialId
Assert-NotPlaceholder -Name 'SearchConsoleProperty' -Value $SearchConsoleProperty

if ($LegacyWebBaseUrl) {
    Assert-NotPlaceholder -Name 'LegacyWebBaseUrl' -Value $LegacyWebBaseUrl
}

if ($SitemapUrls.Count -eq 0) {
    $SitemapUrls = @(
        "$($BaseUrl.TrimEnd('/'))/sitemap.xml",
        "$($BaseUrl.TrimEnd('/'))/question-sitemap.xml"
    )
}

if ($InspectedUrls.Count -eq 0) {
    $InspectedUrls = @(
        "$($BaseUrl.TrimEnd('/'))/",
        "$($BaseUrl.TrimEnd('/'))/planos",
        "$($BaseUrl.TrimEnd('/'))/elite"
    )
}

foreach ($sitemapUrl in $SitemapUrls) {
    Assert-NotPlaceholder -Name 'SitemapUrls' -Value $sitemapUrl
}

foreach ($inspectedUrl in $InspectedUrls) {
    Assert-NotPlaceholder -Name 'InspectedUrls' -Value $inspectedUrl
}

if ($MonitoringWindowDays -lt 1) {
    throw 'MonitoringWindowDays must be at least 1.'
}

if (-not $OutputPath) {
    $OutputPath = 'config/deploy/web-next-stage5-launch.local.json'
}

if ((Test-Path -LiteralPath $OutputPath) -and -not $Force) {
    throw "Stage 5 config already exists: $OutputPath. Re-run with -Force to replace it."
}

$config = [ordered]@{
    Environment = 'production'
    BaseUrl = $BaseUrl
    LegacyWebBaseUrl = $LegacyWebBaseUrl
    ExpectedCanonicalBaseUrl = $ExpectedCanonicalBaseUrl
    QuestionId = $QuestionId
    RankingId = $RankingId
    MaterialId = $MaterialId
    SearchConsoleProperty = $SearchConsoleProperty
    SitemapUrls = $SitemapUrls
    InspectedUrls = $InspectedUrls
    SearchConsoleChecklistCompleted = $SearchConsoleChecklistCompleted
    MonitoringWindowDays = $MonitoringWindowDays
    MonitoringNotes = $MonitoringNotes
    GateOutputPath = 'docs/reports/web-next-production-gate.json'
    OutputPath = 'docs/reports/web-next-stage5-launch-latest.json'
    GateCommand = 'npm run web-next:production-gate'
    GateWorkflow = '.github/workflows/web-next-stage5-launch.yml'
    SearchConsoleRunbook = 'docs/GOOGLE_SEARCH_CONSOLE.md'
    WorkflowRunUrl = $WorkflowRunUrl
    Result = 'pending'
    Notes = $Notes
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$config | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $OutputPath -Encoding utf8

Write-Host "[OK] stage 5 launch config - $OutputPath"
Write-Host "[NEXT] npm run web-next:stage5-validate -- -ConfigPath $OutputPath"

param(
    [string]$ConfigPath = '',
    [string]$OutputPath = 'docs/reports/web-next-stage5-launch-latest.json',
    [string]$GateOutputPath = '',
    [switch]$ValidateOnly,
    [switch]$AllowExampleConfig
)

$ErrorActionPreference = 'Stop'

function Get-MarkdownPath {
    param(
        [string]$JsonPath
    )

    $directory = Split-Path -Parent $JsonPath
    $baseName = [System.IO.Path]::GetFileNameWithoutExtension($JsonPath)
    $markdownFileName = "$baseName.md"

    if ($directory) {
        return Join-Path $directory $markdownFileName
    }

    return $markdownFileName
}

function Assert-RealValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if (-not $Value) {
        throw "Missing required stage 5 launch value: $Name"
    }

    if ($Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com' -or $Value -match 'producao\.exemplo\.com') {
        throw "Replace placeholder value before running stage 5 launch: $Name"
    }

    if ($Value -in @('123', 'abc', 'xyz')) {
        throw "Replace sample entity ID before running stage 5 launch: $Name"
    }
}

if (-not $ConfigPath) {
    $defaultLocalConfigPath = 'config/deploy/web-next-stage5-launch.local.json'
    if (Test-Path -LiteralPath $defaultLocalConfigPath) {
        $ConfigPath = $defaultLocalConfigPath
    }
}

if (-not $ConfigPath) {
    throw 'Missing ConfigPath. Create config/deploy/web-next-stage5-launch.local.json with stage 5 production values.'
}

$resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path

if (-not $AllowExampleConfig -and $resolvedConfigPath -match '\.example\.json$') {
    throw 'Refusing to run stage 5 launch from an example config. Use a .local.json copy with real values, or pass -AllowExampleConfig only to test placeholder validation.'
}

$config = Get-Content -LiteralPath $resolvedConfigPath -Raw | ConvertFrom-Json
$outputPathWasExplicit = $PSBoundParameters.ContainsKey('OutputPath')

$environment = [string]$config.Environment
if (-not $environment) {
    $environment = 'production'
}

if ($environment -ne 'production') {
    throw "Stage 5 launch only supports production. Received: $environment"
}

$baseUrl = [string]$config.BaseUrl
$legacyWebBaseUrl = [string]$config.LegacyWebBaseUrl
$expectedCanonicalBaseUrl = [string]$config.ExpectedCanonicalBaseUrl
$questionId = [string]$config.QuestionId
$rankingId = [string]$config.RankingId
$materialId = [string]$config.MaterialId
$searchConsoleProperty = [string]$config.SearchConsoleProperty
$searchConsoleChecklistCompleted = [bool]$config.SearchConsoleChecklistCompleted
$monitoringWindowDays = [int]$config.MonitoringWindowDays
$monitoringNotes = [string]$config.MonitoringNotes
$gateCommand = [string]$config.GateCommand
$gateWorkflow = [string]$config.GateWorkflow
$searchConsoleRunbook = [string]$config.SearchConsoleRunbook
$workflowRunUrl = [string]$config.WorkflowRunUrl
$notes = [string]$config.Notes

$sitemapUrls = @()
if ($null -ne $config.SitemapUrls) {
    $sitemapUrls = @($config.SitemapUrls | ForEach-Object { [string]$_ })
}

$inspectedUrls = @()
if ($null -ne $config.InspectedUrls) {
    $inspectedUrls = @($config.InspectedUrls | ForEach-Object { [string]$_ })
}

if ($config.OutputPath -and -not $outputPathWasExplicit) {
    $OutputPath = [string]$config.OutputPath
}

if (-not $GateOutputPath) {
    if ($config.GateOutputPath) {
        $GateOutputPath = [string]$config.GateOutputPath
    }
    else {
        $GateOutputPath = 'docs/reports/web-next-production-gate.json'
    }
}

Assert-RealValue -Name 'BaseUrl' -Value $baseUrl
Assert-RealValue -Name 'ExpectedCanonicalBaseUrl' -Value $expectedCanonicalBaseUrl
Assert-RealValue -Name 'QuestionId' -Value $questionId
Assert-RealValue -Name 'RankingId' -Value $rankingId
Assert-RealValue -Name 'MaterialId' -Value $materialId
Assert-RealValue -Name 'SearchConsoleProperty' -Value $searchConsoleProperty

if ($legacyWebBaseUrl) {
    Assert-RealValue -Name 'LegacyWebBaseUrl' -Value $legacyWebBaseUrl
}

if ($sitemapUrls.Count -lt 2) {
    throw 'Stage 5 launch requires at least two sitemap URLs.'
}

if ($inspectedUrls.Count -lt 3) {
    throw 'Stage 5 launch requires at least three inspected URLs.'
}

foreach ($sitemapUrl in $sitemapUrls) {
    Assert-RealValue -Name 'SitemapUrls' -Value $sitemapUrl
}

foreach ($inspectedUrl in $inspectedUrls) {
    Assert-RealValue -Name 'InspectedUrls' -Value $inspectedUrl
}

if ($monitoringWindowDays -lt 1) {
    throw 'MonitoringWindowDays must be at least 1.'
}

if ($searchConsoleRunbook -and -not (Test-Path -LiteralPath $searchConsoleRunbook)) {
    throw "SearchConsoleRunbook was not found: $searchConsoleRunbook"
}

$gateSummaryPath = Join-Path (Split-Path -Parent $GateOutputPath) ("$([System.IO.Path]::GetFileNameWithoutExtension($GateOutputPath)).summary.md")
$gateExitCode = 0
$gatePassed = $false
$gateReport = $null
$gateSummary = $null

if (-not $ValidateOnly) {
    $gateArguments = @(
        '-Environment', 'production',
        '-BaseUrl', $baseUrl,
        '-ExpectedCanonicalBaseUrl', $expectedCanonicalBaseUrl,
        '-QuestionId', $questionId,
        '-RankingId', $rankingId,
        '-MaterialId', $materialId,
        '-OutputPath', $GateOutputPath
    )

    if ($legacyWebBaseUrl) {
        $gateArguments += @('-LegacyWebBaseUrl', $legacyWebBaseUrl)
    }

    & powershell -ExecutionPolicy Bypass -File scripts/checks/run-web-next-staging-gate.ps1 @gateArguments
    $gateExitCode = $LASTEXITCODE

    if (Test-Path -LiteralPath $GateOutputPath) {
        $gateReport = Get-Content -LiteralPath $GateOutputPath -Raw | ConvertFrom-Json
        if ($null -ne $gateReport.summary -and $null -ne $gateReport.summary.passed) {
            $gatePassed = [bool]$gateReport.summary.passed
        }
        elseif ($null -ne $gateReport.passed) {
            $gatePassed = [bool]$gateReport.passed
        }

        $gateSummary = $gateReport.summary
    }
}

$checklistReady = $searchConsoleChecklistCompleted -and $sitemapUrls.Count -ge 2 -and $inspectedUrls.Count -ge 3
$monitoringReady = -not [string]::IsNullOrWhiteSpace($monitoringNotes) -and $monitoringWindowDays -ge 1
$launchPassed = $gatePassed -and $checklistReady -and $monitoringReady
$commandPassed = if ($ValidateOnly) { $true } else { $launchPassed }

$launchResult = if ($ValidateOnly) {
    'validated'
}
elseif (-not $gatePassed) {
    'failed'
}
elseif (-not $searchConsoleChecklistCompleted) {
    'checklist-pending'
}
elseif (-not $monitoringReady) {
    'monitoring-pending'
}
else {
    'passed'
}

$completedItems = @(
    'production launch config loaded',
    'placeholder guard passed',
    'search console metadata checked'
)

if ($ValidateOnly) {
    $completedItems += 'stage 5 config validated'
}
else {
    $completedItems += 'production gate executed'
}

if (-not $ValidateOnly -and $gatePassed) {
    $completedItems += 'production gate passed'
}

if (-not $ValidateOnly -and $searchConsoleChecklistCompleted) {
    $completedItems += 'search console checklist recorded'
}

if (-not $ValidateOnly -and $monitoringReady) {
    $completedItems += 'monitoring window recorded'
}

$remainingItems = @()
if ($ValidateOnly) {
    $remainingItems += 'executar o production gate com a config validada'
}
elseif (-not $gatePassed) {
    $remainingItems += 'corrigir falhas do production gate e executar novamente'
}

if (-not $searchConsoleChecklistCompleted) {
    $remainingItems += 'registrar envio dos sitemaps e inspecoes no Search Console'
}

if (-not $monitoringReady) {
    $remainingItems += 'registrar o plano de monitoramento dos primeiros dias'
}

$report = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        current = 5
        total = 5
    }
    status = [ordered]@{
        passed = $commandPassed
        result = $launchResult
        validateOnly = [bool]$ValidateOnly
        gatePassed = $gatePassed
        searchConsoleChecklistCompleted = $searchConsoleChecklistCompleted
        monitoringReady = $monitoringReady
        launchPassed = $launchPassed
        gateExitCode = $gateExitCode
    }
    environment = [ordered]@{
        name = 'production'
        baseUrl = $baseUrl
        legacyWebBaseUrl = $legacyWebBaseUrl
        expectedCanonicalBaseUrl = $expectedCanonicalBaseUrl
    }
    entityIds = [ordered]@{
        questionId = $questionId
        rankingId = $rankingId
        materialId = $materialId
    }
    searchConsole = [ordered]@{
        property = $searchConsoleProperty
        sitemapUrls = $sitemapUrls
        inspectedUrls = $inspectedUrls
        checklistCompleted = $searchConsoleChecklistCompleted
        runbook = $searchConsoleRunbook
    }
    monitoring = [ordered]@{
        windowDays = $monitoringWindowDays
        notes = $monitoringNotes
    }
    evidence = [ordered]@{
        launchConfig = $ConfigPath
        gateReport = $GateOutputPath
        gateSummary = $gateSummaryPath
        gateCommand = $gateCommand
        gateWorkflow = $gateWorkflow
        workflowRunUrl = $workflowRunUrl
    }
    summary = [ordered]@{
        completedItems = $completedItems
        remainingItems = $remainingItems
        gate = $gateSummary
    }
    notes = $notes
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

$markdownPath = Get-MarkdownPath -JsonPath $OutputPath
$markdownLines = @(
    '# Web Next Stage 5 Launch',
    '',
    "- Gerado em: $($report.generatedAt)",
    "- Macroetapa atual: 5/5",
    "- Resultado: $($report.status.result)",
    "- Base URL: $baseUrl",
    "- Canonical esperado: $expectedCanonicalBaseUrl",
    "- Search Console property: $searchConsoleProperty",
    '',
    '## Evidencias',
    '',
    "- Config launch: $ConfigPath",
    "- Relatorio gate: $GateOutputPath",
    "- Resumo gate: $gateSummaryPath",
    "- Workflow definido: $(if ($gateWorkflow) { $gateWorkflow } else { 'n/a' })",
    "- Execucao CI: $(if ($workflowRunUrl) { $workflowRunUrl } else { 'n/a' })",
    '',
    '## Concluido',
    ''
)

foreach ($item in $completedItems) {
    $markdownLines += "- $item"
}

if ($remainingItems.Count -gt 0) {
    $markdownLines += @(
        '',
        '## Pendencias',
        ''
    )

    foreach ($item in $remainingItems) {
        $markdownLines += "- $item"
    }
}

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] stage 5 launch report - $OutputPath"
Write-Host "[OK] stage 5 launch markdown - $markdownPath"

if (-not $commandPassed) {
    exit 1
}

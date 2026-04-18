param(
    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',
    [string]$ConfigPath = '',
    [string]$OutputPath = 'docs/reports/web-next-stage4-rollout-latest.json',
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

function Assert-RealValue {
    param(
        [string]$Name,
        [string]$Value
    )

    if (-not $Value) {
        throw "Missing required stage 4 rollout value: $Name"
    }

    if ($Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com') {
        throw "Replace placeholder value before running stage 4 rollout: $Name"
    }

    if ($Value -in @('123', 'abc', 'xyz')) {
        throw "Replace sample entity ID before running stage 4 rollout: $Name"
    }
}

if (-not $ConfigPath) {
    $defaultLocalConfigPath = Join-Path 'config\deploy' "web-next-$Environment-rollout.local.json"
    if (Test-Path -LiteralPath $defaultLocalConfigPath) {
        $ConfigPath = $defaultLocalConfigPath
    }
    else {
        $stagingLocalConfigPath = Join-Path 'config\deploy' 'web-next-staging-rollout.local.json'
        if ($Environment -eq 'staging' -and (Test-Path -LiteralPath $stagingLocalConfigPath)) {
            $ConfigPath = $stagingLocalConfigPath
        }
    }
}

if (-not $ConfigPath) {
    throw 'Missing ConfigPath. Copy config/deploy/web-next-staging-rollout.example.json to config/deploy/web-next-staging-rollout.local.json and fill real environment values.'
}

$resolvedConfigPath = (Resolve-Path -LiteralPath $ConfigPath).Path

if (-not $AllowExampleConfig -and $resolvedConfigPath -match '\.example\.json$') {
    throw 'Refusing to run stage 4 rollout from an example config. Use a .local.json copy with real values, or pass -AllowExampleConfig only to test placeholder validation.'
}

$config = Get-Content -LiteralPath $resolvedConfigPath -Raw | ConvertFrom-Json

if ($config.Environment) {
    $Environment = [string]$config.Environment
}

if ($Environment -notin @('staging', 'production')) {
    throw "Invalid rollout environment: $Environment"
}

$baseUrl = [string]$config.BaseUrl
$legacyWebBaseUrl = [string]$config.LegacyWebBaseUrl
$expectedCanonicalBaseUrl = [string]$config.ExpectedCanonicalBaseUrl
$questionId = [string]$config.QuestionId
$rankingId = [string]$config.RankingId
$materialId = [string]$config.MaterialId
$proxyMode = [string]$config.ProxyMode
$proxyConfigReference = [string]$config.ProxyConfigReference
$gateCommand = [string]$config.GateCommand
$gateWorkflow = [string]$config.GateWorkflow
$workflowRunUrl = [string]$config.WorkflowRunUrl
$notes = [string]$config.Notes
$proxyCheckOutputPath = ''
$proxyCheckMarkdownPath = ''
$proxyContentChecked = $false

$outputPathWasExplicit = $PSBoundParameters.ContainsKey('OutputPath')

if ($config.OutputPath -and -not $outputPathWasExplicit) {
    $OutputPath = [string]$config.OutputPath
}

if (-not $GateOutputPath) {
    if ($config.GateOutputPath) {
        $GateOutputPath = [string]$config.GateOutputPath
    }
    else {
        $GateOutputPath = if ($Environment -eq 'production') {
            'docs/reports/web-next-production-gate.json'
        }
        else {
            'docs/reports/web-next-staging-gate.json'
        }
    }
}

Assert-RealValue -Name 'BaseUrl' -Value $baseUrl
Assert-RealValue -Name 'ExpectedCanonicalBaseUrl' -Value $expectedCanonicalBaseUrl
Assert-RealValue -Name 'QuestionId' -Value $questionId
Assert-RealValue -Name 'RankingId' -Value $rankingId
Assert-RealValue -Name 'MaterialId' -Value $materialId

if ($legacyWebBaseUrl) {
    Assert-RealValue -Name 'LegacyWebBaseUrl' -Value $legacyWebBaseUrl
}

if (-not $proxyMode) {
    $proxyMode = if ($legacyWebBaseUrl) { 'hybrid' } else { 'next-only' }
}

if ($proxyMode -notin @('hybrid', 'next-only')) {
    throw "Invalid ProxyMode: $proxyMode"
}

if ($proxyMode -eq 'hybrid' -and -not $legacyWebBaseUrl) {
    throw 'ProxyMode is hybrid, but LegacyWebBaseUrl is missing.'
}

if ($proxyMode -eq 'next-only' -and $legacyWebBaseUrl) {
    throw 'ProxyMode is next-only, but LegacyWebBaseUrl was provided.'
}

if ($proxyConfigReference) {
    if ($proxyConfigReference -notmatch '^https?://') {
        if (-not (Test-Path -LiteralPath $proxyConfigReference)) {
            throw "ProxyConfigReference was not found: $proxyConfigReference"
        }

        $proxyCheckOutputPath = Get-DetailedReportPath -CombinedPath $OutputPath -Suffix 'proxy'
        $proxyCheckMarkdownPath = Get-MarkdownPath -JsonPath $proxyCheckOutputPath

        & powershell -ExecutionPolicy Bypass -File scripts/checks/run-web-next-stage4-proxy-check.ps1 -ProxyConfigPath $proxyConfigReference -ProxyMode $proxyMode -OutputPath $proxyCheckOutputPath
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }

        $proxyContentChecked = $true
    }
}

$gateSummaryPath = Get-SummaryReportPath -JsonPath $GateOutputPath
$gatePublicReportPath = $null
$gateLegacyReportPath = $null
$gatePublicSummaryPath = $null
$gateLegacySummaryPath = $null
$gateExitCode = 0
$gateReport = $null
$gatePassed = $false
$gateSummary = $null

if ($legacyWebBaseUrl) {
    $gatePublicReportPath = Get-DetailedReportPath -CombinedPath $GateOutputPath -Suffix 'public'
    $gateLegacyReportPath = Get-DetailedReportPath -CombinedPath $GateOutputPath -Suffix 'legacy'
    $gatePublicSummaryPath = Get-SummaryReportPath -JsonPath $gatePublicReportPath
    $gateLegacySummaryPath = Get-SummaryReportPath -JsonPath $gateLegacyReportPath
}

if (-not $ValidateOnly) {
    $gateArguments = @(
        '-Environment', $Environment,
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
        elseif ($null -ne $gateReport.summary) {
            $gateFailCount = 0
            if ($null -ne $gateReport.summary.fail) {
                $gateFailCount = [int]$gateReport.summary.fail
            }
            elseif ($null -ne $gateReport.summary.failures) {
                $gateFailCount = [int]$gateReport.summary.failures
            }

            $gatePassed = $gateFailCount -eq 0
        }

        $gateSummary = $gateReport.summary
    }
}

$completedItems = @(
    'rollout config loaded',
    'placeholder guard passed',
    'proxy config reference checked'
)

if ($proxyContentChecked) {
    $completedItems += 'proxy config content checked'
}

if ($ValidateOnly) {
    $completedItems += 'stage 4 config validated'
}
else {
    $completedItems += 'environment gate executed'
}

if (-not $ValidateOnly -and $gateExitCode -eq 0 -and $gatePassed) {
    $completedItems += 'stage 4 gate passed'
}

$remainingItems = @()
if ($ValidateOnly) {
    $remainingItems += 'executar o gate de staging com a config validada'
}
elseif ($gateExitCode -ne 0 -or -not $gatePassed) {
    $remainingItems += 'corrigir falhas do gate de staging e executar novamente'
}

if (-not $workflowRunUrl) {
    $remainingItems += 'registrar link do workflow manual quando a validacao rodar no CI'
}

if (-not $notes) {
    $remainingItems += 'registrar notas da configuracao de proxy aplicada'
}

$configPassed = $true
$rolloutPassed = $gateExitCode -eq 0 -and $gatePassed
$commandPassed = if ($ValidateOnly) { $configPassed } else { $rolloutPassed }
$rolloutResult = if ($ValidateOnly) {
    'validated'
}
elseif ($rolloutPassed) {
    'passed'
}
else {
    'failed'
}

$report = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        current = 4
        total = 5
        next = 5
    }
    status = [ordered]@{
        passed = $commandPassed
        result = $rolloutResult
        validateOnly = [bool]$ValidateOnly
        configPassed = $configPassed
        rolloutPassed = $rolloutPassed
        gatePassed = $gatePassed
        gateExitCode = $gateExitCode
    }
    environment = [ordered]@{
        name = $Environment
        baseUrl = $baseUrl
        legacyWebBaseUrl = $legacyWebBaseUrl
        expectedCanonicalBaseUrl = $expectedCanonicalBaseUrl
        proxyMode = $proxyMode
        proxyConfigReference = $proxyConfigReference
    }
    entityIds = [ordered]@{
        questionId = $questionId
        rankingId = $rankingId
        materialId = $materialId
    }
    evidence = [ordered]@{
        rolloutConfig = $ConfigPath
        gateReport = $GateOutputPath
        gateSummary = $gateSummaryPath
        gatePublicReport = $gatePublicReportPath
        gatePublicSummary = $gatePublicSummaryPath
        gateLegacyReport = $gateLegacyReportPath
        gateLegacySummary = $gateLegacySummaryPath
        gateCommand = $gateCommand
        gateWorkflow = $gateWorkflow
        workflowRunUrl = $workflowRunUrl
        proxyCheckReport = $proxyCheckOutputPath
        proxyCheckMarkdown = $proxyCheckMarkdownPath
    }
    summary = [ordered]@{
        completedItems = $completedItems
        remainingItems = $remainingItems
        gate = $gateSummary
    }
    macro5 = [ordered]@{
        opensWhen = 'stage 4 gate passes with real staging host, canonical host and entity IDs'
        nextSteps = @(
            'publicar dominio final',
            'executar production gate',
            'enviar sitemaps no Google Search Console',
            'acompanhar indexacao e canonicals reais'
        )
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
    '# Web Next Stage 4 Rollout',
    '',
    "- Gerado em: $($report.generatedAt)",
    "- Macroetapa atual: 4/5",
    "- Resultado: $($report.status.result)",
    "- Ambiente: $Environment",
    "- URL Next: $baseUrl",
    "- URL legada: $(if ($legacyWebBaseUrl) { $legacyWebBaseUrl } else { 'n/a' })",
    "- Canonical esperado: $expectedCanonicalBaseUrl",
    "- Proxy mode: $proxyMode",
    "- Proxy config: $(if ($proxyConfigReference) { $proxyConfigReference } else { 'n/a' })",
    '',
    '## Evidencias',
    '',
    "- Config rollout: $ConfigPath",
    "- Relatorio gate: $GateOutputPath",
    "- Resumo gate: $gateSummaryPath",
    "- Relatorio proxy: $(if ($proxyCheckOutputPath) { $proxyCheckOutputPath } else { 'n/a' })",
    "- Comando: $(if ($gateCommand) { $gateCommand } else { 'n/a' })",
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

$markdownLines += @(
    '',
    '## Proxima macro',
    '',
    '- Macro 5 abre apos o gate real de staging passar.',
    '- O proximo foco e production gate, Search Console, sitemaps e acompanhamento de canonicals.'
)

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] stage 4 rollout report - $OutputPath"
Write-Host "[OK] stage 4 rollout markdown - $markdownPath"

if (-not $commandPassed) {
    exit 1
}

param(
    [string]$ConfigPath = '',
    [string]$LaunchReportPath = 'docs/reports/web-next-stage5-launch-latest.json',
    [string]$OutputPath = 'docs/reports/web-next-stage5-status-latest.json',
    [switch]$RequireCompleted
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

function Test-PlaceholderValue {
    param(
        [string]$Value
    )

    if (-not $Value) {
        return $false
    }

    return $Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com' -or $Value -match 'producao\.exemplo\.com' -or $Value -in @('123', 'abc', 'xyz')
}

if (-not $ConfigPath) {
    $defaultLocalConfigPath = 'config/deploy/web-next-stage5-launch.local.json'
    if (Test-Path -LiteralPath $defaultLocalConfigPath) {
        $ConfigPath = $defaultLocalConfigPath
    }
}

$configExists = $ConfigPath -and (Test-Path -LiteralPath $ConfigPath)
$config = $null
$configIssues = @()

if ($configExists) {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

    foreach ($fieldName in @('BaseUrl', 'ExpectedCanonicalBaseUrl', 'QuestionId', 'RankingId', 'MaterialId', 'SearchConsoleProperty')) {
        $fieldValue = [string]$config.$fieldName
        if (-not $fieldValue) {
            $configIssues += "missing $fieldName"
        }
        elseif (Test-PlaceholderValue -Value $fieldValue) {
            $configIssues += "placeholder $fieldName"
        }
    }

    $sitemapUrls = @($config.SitemapUrls)
    if ($sitemapUrls.Count -lt 2) {
        $configIssues += 'missing sitemap URLs'
    }

    $inspectedUrls = @($config.InspectedUrls)
    if ($inspectedUrls.Count -lt 3) {
        $configIssues += 'missing inspected URLs'
    }

    if ([int]$config.MonitoringWindowDays -lt 1) {
        $configIssues += 'invalid MonitoringWindowDays'
    }
}
else {
    $configIssues += 'missing launch config'
}

$configReady = $configExists -and $configIssues.Count -eq 0

$launchReportExists = Test-Path -LiteralPath $LaunchReportPath
$launchReport = $null
$launchResult = 'missing'
$gatePassed = $false
$checklistCompleted = $false
$monitoringReady = $false
$launchPassed = $false

if ($launchReportExists) {
    $launchReport = Get-Content -LiteralPath $LaunchReportPath -Raw | ConvertFrom-Json
    $launchResult = [string]$launchReport.status.result
    $gatePassed = [bool]$launchReport.status.gatePassed
    $checklistCompleted = [bool]$launchReport.status.searchConsoleChecklistCompleted
    $monitoringReady = [bool]$launchReport.status.monitoringReady
    $launchPassed = [bool]$launchReport.status.launchPassed
}

$state = 'missing-config'
if (-not $configExists) {
    $state = 'missing-config'
}
elseif (-not $configReady) {
    $state = 'config-invalid'
}
elseif ($launchPassed) {
    $state = 'completed'
}
elseif ($gatePassed -and -not $checklistCompleted) {
    $state = 'search-console-pending'
}
elseif ($gatePassed -and $checklistCompleted -and -not $monitoringReady) {
    $state = 'monitoring-pending'
}
elseif ($launchResult -eq 'validated') {
    $state = 'config-validated'
}
elseif ($gatePassed) {
    $state = 'production-gate-passed'
}
else {
    $state = 'config-ready'
}

$remainingItems = @()
switch ($state) {
    'missing-config' { $remainingItems += 'gerar config local com web-next:stage5-init-config' }
    'config-invalid' { $remainingItems += 'corrigir campos da config local da macro 5' }
    'config-ready' {
        $remainingItems += 'rodar web-next:stage5-validate'
        $remainingItems += 'rodar web-next:stage5-launch com producao real'
    }
    'config-validated' { $remainingItems += 'rodar web-next:stage5-launch com producao real' }
    'production-gate-passed' { $remainingItems += 'registrar checklist do Search Console e monitoramento inicial' }
    'search-console-pending' { $remainingItems += 'registrar envio dos sitemaps e inspecoes no Search Console' }
    'monitoring-pending' { $remainingItems += 'registrar o plano de monitoramento dos primeiros dias' }
}

$report = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        current = 5
        total = 5
    }
    status = [ordered]@{
        state = $state
        configExists = [bool]$configExists
        configReady = [bool]$configReady
        gatePassed = [bool]$gatePassed
        searchConsoleChecklistCompleted = [bool]$checklistCompleted
        monitoringReady = [bool]$monitoringReady
        completed = [bool]$launchPassed
    }
    config = [ordered]@{
        path = $ConfigPath
        issues = $configIssues
        baseUrl = if ($config) { [string]$config.BaseUrl } else { '' }
        expectedCanonicalBaseUrl = if ($config) { [string]$config.ExpectedCanonicalBaseUrl } else { '' }
        searchConsoleProperty = if ($config) { [string]$config.SearchConsoleProperty } else { '' }
    }
    evidence = [ordered]@{
        launchReport = $LaunchReportPath
        launchReportExists = [bool]$launchReportExists
        launchResult = $launchResult
    }
    remainingItems = $remainingItems
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

$markdownPath = Get-MarkdownPath -JsonPath $OutputPath
$markdownLines = @(
    '# Web Next Stage 5 Status',
    '',
    "- Gerado em: $($report.generatedAt)",
    "- Estado: $state",
    "- Macro atual: 5/5",
    "- Config existe: $($report.status.configExists)",
    "- Config pronta: $($report.status.configReady)",
    "- Production gate passou: $($report.status.gatePassed)",
    "- Search Console registrado: $($report.status.searchConsoleChecklistCompleted)",
    "- Monitoramento registrado: $($report.status.monitoringReady)",
    "- Macro concluida: $($report.status.completed)",
    '',
    '## Proximos passos',
    ''
)

if ($remainingItems.Count -eq 0) {
    $markdownLines += '- nenhuma pendencia bloqueante registrada'
}
else {
    foreach ($item in $remainingItems) {
        $markdownLines += "- $item"
    }
}

if ($configIssues.Count -gt 0) {
    $markdownLines += @(
        '',
        '## Problemas de config',
        ''
    )

    foreach ($issue in $configIssues) {
        $markdownLines += "- $issue"
    }
}

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] stage 5 status report - $OutputPath"
Write-Host "[OK] stage 5 status markdown - $markdownPath"
Write-Host "[STATE] $state"

if ($RequireCompleted -and -not $launchPassed) {
    exit 1
}

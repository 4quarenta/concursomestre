param(
    [ValidateSet('staging', 'production')]
    [string]$Environment = 'staging',
    [string]$ConfigPath = '',
    [string]$RolloutReportPath = 'docs/reports/web-next-stage4-rollout-latest.json',
    [string]$HandoffReportPath = 'docs/reports/web-next-stage4-handoff-latest.json',
    [string]$OutputPath = 'docs/reports/web-next-stage4-status-latest.json',
    [switch]$RequireMacro5Ready
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

    return $Value -match 'seu-dominio\.com' -or $Value -match 'exemplo\.com' -or $Value -in @('123', 'abc', 'xyz')
}

function Add-ConfigIssue {
    param(
        [string[]]$Issues,
        [string]$Message
    )

    return @($Issues + $Message)
}

if (-not $ConfigPath) {
    $candidateConfigPath = Join-Path 'config\deploy' "web-next-$Environment-rollout.local.json"
    if (Test-Path -LiteralPath $candidateConfigPath) {
        $ConfigPath = $candidateConfigPath
    }
    elseif ($Environment -eq 'staging') {
        $stagingConfigPath = Join-Path 'config\deploy' 'web-next-staging-rollout.local.json'
        if (Test-Path -LiteralPath $stagingConfigPath) {
            $ConfigPath = $stagingConfigPath
        }
    }
}

$configExists = $ConfigPath -and (Test-Path -LiteralPath $ConfigPath)
$config = $null
$configIssues = @()

if ($configExists) {
    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json

    foreach ($fieldName in @('BaseUrl', 'ExpectedCanonicalBaseUrl', 'QuestionId', 'RankingId', 'MaterialId')) {
        $fieldValue = [string]$config.$fieldName

        if (-not $fieldValue) {
            $configIssues = Add-ConfigIssue -Issues $configIssues -Message "missing $fieldName"
        }
        elseif (Test-PlaceholderValue -Value $fieldValue) {
            $configIssues = Add-ConfigIssue -Issues $configIssues -Message "placeholder $fieldName"
        }
    }

    $proxyMode = [string]$config.ProxyMode
    $legacyWebBaseUrl = [string]$config.LegacyWebBaseUrl

    if (-not $proxyMode) {
        $proxyMode = if ($legacyWebBaseUrl) { 'hybrid' } else { 'next-only' }
    }

    if ($proxyMode -notin @('hybrid', 'next-only')) {
        $configIssues = Add-ConfigIssue -Issues $configIssues -Message "invalid ProxyMode"
    }

    if ($proxyMode -eq 'hybrid') {
        if (-not $legacyWebBaseUrl) {
            $configIssues = Add-ConfigIssue -Issues $configIssues -Message 'missing LegacyWebBaseUrl for hybrid proxy'
        }
        elseif (Test-PlaceholderValue -Value $legacyWebBaseUrl) {
            $configIssues = Add-ConfigIssue -Issues $configIssues -Message 'placeholder LegacyWebBaseUrl'
        }
    }

    if ($proxyMode -eq 'next-only' -and $legacyWebBaseUrl) {
        $configIssues = Add-ConfigIssue -Issues $configIssues -Message 'LegacyWebBaseUrl set for next-only proxy'
    }

    $proxyConfigReference = [string]$config.ProxyConfigReference
    if ($proxyConfigReference -and $proxyConfigReference -notmatch '^https?://') {
        if (-not (Test-Path -LiteralPath $proxyConfigReference)) {
            $configIssues = Add-ConfigIssue -Issues $configIssues -Message 'ProxyConfigReference not found'
        }
    }
}
else {
    $configIssues = Add-ConfigIssue -Issues $configIssues -Message 'missing rollout config'
}

$configReady = $configExists -and $configIssues.Count -eq 0

$rolloutExists = Test-Path -LiteralPath $RolloutReportPath
$rolloutReport = $null
$rolloutResult = 'missing'
$configValidated = $false
$rolloutPassed = $false
$proxyCheckReport = ''
$proxyCheckMarkdown = ''

if ($rolloutExists) {
    $rolloutReport = Get-Content -LiteralPath $RolloutReportPath -Raw | ConvertFrom-Json
    $rolloutResult = [string]$rolloutReport.status.result
    $configValidated = [bool]$rolloutReport.status.configPassed
    $rolloutPassed = [bool]$rolloutReport.status.rolloutPassed
    $proxyCheckReport = [string]$rolloutReport.evidence.proxyCheckReport
    $proxyCheckMarkdown = [string]$rolloutReport.evidence.proxyCheckMarkdown
}

$handoffExists = Test-Path -LiteralPath $HandoffReportPath
$handoffReport = $null
$macro5Ready = $false

if ($handoffExists) {
    $handoffReport = Get-Content -LiteralPath $HandoffReportPath -Raw | ConvertFrom-Json
    $macro5Ready = [bool]$handoffReport.status.macro5Ready
}

$state = 'missing-config'
if (-not $configExists) {
    $state = 'missing-config'
}
elseif (-not $configReady) {
    $state = 'config-invalid'
}
elseif ($macro5Ready) {
    $state = 'macro5-ready'
}
elseif ($rolloutPassed) {
    $state = 'rollout-passed'
}
elseif ($configValidated -or $rolloutResult -eq 'validated') {
    $state = 'config-validated'
}
else {
    $state = 'config-ready'
}

$remainingItems = @()
switch ($state) {
    'missing-config' {
        $remainingItems += 'gerar config local com web-next:stage4-init-config'
    }
    'config-invalid' {
        $remainingItems += 'corrigir campos da config local da macro 4'
    }
    'config-ready' {
        $remainingItems += 'rodar web-next:stage4-config-check'
        $remainingItems += 'rodar web-next:stage4-rollout com staging real'
    }
    'config-validated' {
        $remainingItems += 'rodar web-next:stage4-rollout com staging real'
    }
    'rollout-passed' {
        $remainingItems += 'rodar web-next:stage4-handoff'
    }
}

$report = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        current = if ($macro5Ready) { 5 } else { 4 }
        total = 5
    }
    status = [ordered]@{
        state = $state
        configExists = [bool]$configExists
        configReady = [bool]$configReady
        configValidated = [bool]$configValidated
        rolloutPassed = [bool]$rolloutPassed
        macro5Ready = [bool]$macro5Ready
    }
    config = [ordered]@{
        path = $ConfigPath
        issues = $configIssues
        environment = if ($config) { [string]$config.Environment } else { $Environment }
        baseUrl = if ($config) { [string]$config.BaseUrl } else { '' }
        legacyWebBaseUrl = if ($config) { [string]$config.LegacyWebBaseUrl } else { '' }
        expectedCanonicalBaseUrl = if ($config) { [string]$config.ExpectedCanonicalBaseUrl } else { '' }
        proxyMode = if ($config) { [string]$config.ProxyMode } else { '' }
        proxyConfigReference = if ($config) { [string]$config.ProxyConfigReference } else { '' }
    }
    evidence = [ordered]@{
        rolloutReport = $RolloutReportPath
        rolloutReportExists = [bool]$rolloutExists
        rolloutResult = $rolloutResult
        proxyCheckReport = $proxyCheckReport
        proxyCheckMarkdown = $proxyCheckMarkdown
        proxyCheckReportExists = [bool]($proxyCheckReport -and (Test-Path -LiteralPath $proxyCheckReport))
        handoffReport = $HandoffReportPath
        handoffReportExists = [bool]$handoffExists
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
    '# Web Next Stage 4 Status',
    '',
    "- Gerado em: $($report.generatedAt)",
    "- Estado: $state",
    "- Macro atual: $($report.macroStage.current)/$($report.macroStage.total)",
    "- Config existe: $($report.status.configExists)",
    "- Config pronta: $($report.status.configReady)",
    "- Config validada: $($report.status.configValidated)",
    "- Rollout real passou: $($report.status.rolloutPassed)",
    "- Macro 5 pronta: $($report.status.macro5Ready)",
    '',
    '## Config',
    '',
    "- Caminho: $(if ($ConfigPath) { $ConfigPath } else { 'n/a' })",
    "- Base URL: $($report.config.baseUrl)",
    "- Legacy URL: $($report.config.legacyWebBaseUrl)",
    "- Canonical esperado: $($report.config.expectedCanonicalBaseUrl)",
    "- Proxy mode: $($report.config.proxyMode)",
    "- Proxy check: $(if ($proxyCheckReport) { $proxyCheckReport } else { 'n/a' })",
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

Write-Host "[OK] stage 4 status report - $OutputPath"
Write-Host "[OK] stage 4 status markdown - $markdownPath"
Write-Host "[STATE] $state"

if ($RequireMacro5Ready -and -not $macro5Ready) {
    exit 1
}

param(
    [string]$WebNextBaseUrl = 'http://localhost:3001',
    [string]$LegacyWebBaseUrl = 'http://localhost:3000',
    [string]$ExpectedCanonicalBaseUrl = '',
    [string]$OutputPath = 'docs/reports/web-next-cutover-handoff-latest.json',
    [string]$HybridReportPath = 'docs/reports/web-next-hybrid-local-latest.json'
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

function Get-SummaryPath {
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

$hybridReportArguments = @(
    '-WebNextBaseUrl', $WebNextBaseUrl,
    '-LegacyWebBaseUrl', $LegacyWebBaseUrl,
    '-OutputPath', $HybridReportPath
)

if ($ExpectedCanonicalBaseUrl) {
    $hybridReportArguments += @('-ExpectedCanonicalBaseUrl', $ExpectedCanonicalBaseUrl)
}

& powershell -ExecutionPolicy Bypass -File scripts/checks/run-web-next-hybrid-local-report.ps1 @hybridReportArguments

if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
}

$hybridReport = Get-Content -LiteralPath $HybridReportPath -Raw | ConvertFrom-Json
$hybridSummaryPath = Get-SummaryPath -JsonPath $HybridReportPath
$macro4PlaybookPath = 'docs/WEB_NEXT_STAGE4_STAGING.md'
$macro4TemplatePath = 'config/deploy/web-next-staging-rollout.example.json'

$handoffReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        completed = 3
        total = 5
        current = 4
    }
    status = [ordered]@{
        macro3Completed = [bool]$hybridReport.summary.passed
        macro4Started = $true
    }
    environment = [ordered]@{
        webNextBaseUrl = $WebNextBaseUrl
        legacyWebBaseUrl = $LegacyWebBaseUrl
        expectedCanonicalBaseUrl = $ExpectedCanonicalBaseUrl
    }
    evidence = [ordered]@{
        hybridReport = $HybridReportPath
        hybridSummary = $hybridSummaryPath
        cutoverReport = 'docs/reports/web-next-cutover-local.json'
        cutoverSummary = 'docs/reports/web-next-cutover-local.summary.md'
        legacyBridgeReport = 'docs/reports/web-next-legacy-bridge-check-local.json'
        legacyBridgeSummary = 'docs/reports/web-next-legacy-bridge-check-local.summary.md'
    }
    macro3 = [ordered]@{
        title = 'Corte operacional pronto no repositorio'
        completedItems = @(
            'checks publicos do Next consolidados',
            'checks de handoff para SPA legada consolidados',
            'relatorios JSON e Markdown padronizados',
            'workflows manuais com artifact e summary',
            'templates de gate por ambiente'
        )
        completionGate = [ordered]@{
            passed = [bool]$hybridReport.summary.passed
            cutoverOk = [int]$hybridReport.summary.cutover.ok
            cutoverFail = [int]$hybridReport.summary.cutover.fail
            legacyBridgeOk = [int]$hybridReport.summary.legacyBridge.ok
            legacyBridgeFail = [int]$hybridReport.summary.legacyBridge.fail
        }
    }
    macro4 = [ordered]@{
        title = 'Validacao em staging e proxy real'
        nextSteps = @(
            'aplicar o proxy real no ambiente de staging',
            'preencher o template de rollout com dominio, IDs reais e links de execucao',
            'executar web-next:staging-gate com dominio real e, se necessario, LegacyWebBaseUrl',
            'registrar resultado no playbook da macro 4'
        )
        references = @(
            $macro4PlaybookPath,
            $macro4TemplatePath,
            '.github/workflows/web-next-staging-gate.yml'
        )
    }
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$handoffReport | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

$markdownPath = Get-MarkdownPath -JsonPath $OutputPath
$markdownLines = @(
    '# Web Next Cutover Handoff',
    '',
    "- Gerado em: $($handoffReport.generatedAt)",
    "- Macroetapa concluida: 3/5",
    "- Macroetapa atual: 4/5",
    "- Macro 3 concluida: $($handoffReport.status.macro3Completed)",
    '',
    '## Evidencias',
    '',
    "- Relatorio hibrido: $($handoffReport.evidence.hybridReport)",
    "- Resumo hibrido: $($handoffReport.evidence.hybridSummary)",
    "- Relatorio publico: $($handoffReport.evidence.cutoverReport)",
    "- Resumo publico: $($handoffReport.evidence.cutoverSummary)",
    "- Relatorio de bridges: $($handoffReport.evidence.legacyBridgeReport)",
    "- Resumo de bridges: $($handoffReport.evidence.legacyBridgeSummary)",
    '',
    '## Macro 4',
    '',
    '- Aplicar o proxy real no ambiente de staging',
    '- Executar o gate com dominio real e IDs reais',
    '- Registrar a rodada no playbook de staging',
    '',
    '## Referencias',
    '',
    "- $macro4PlaybookPath",
    "- $macro4TemplatePath",
    '- .github/workflows/web-next-staging-gate.yml'
)

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] cutover handoff report - $OutputPath"
Write-Host "[OK] cutover handoff markdown - $markdownPath"

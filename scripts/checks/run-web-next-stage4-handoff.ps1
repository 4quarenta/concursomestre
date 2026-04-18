param(
    [string]$Stage4ReportPath = 'docs/reports/web-next-stage4-rollout-latest.json',
    [string]$OutputPath = 'docs/reports/web-next-stage4-handoff-latest.json'
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

if (-not (Test-Path -LiteralPath $Stage4ReportPath)) {
    throw "Stage 4 report not found: $Stage4ReportPath"
}

$stage4Report = Get-Content -LiteralPath $Stage4ReportPath -Raw | ConvertFrom-Json
$stage4Status = $stage4Report.status
$stage4Passed = [bool]$stage4Status.rolloutPassed
$configValidated = [bool]$stage4Status.configPassed
$validateOnly = [bool]$stage4Status.validateOnly
$macro5Ready = $stage4Passed -and -not $validateOnly

$remainingItems = @()
if (-not $configValidated) {
    $remainingItems += 'validar a configuracao da macro 4'
}

if ($validateOnly) {
    $remainingItems += 'executar web-next:stage4-rollout com o gate HTTP real'
}

if (-not $stage4Passed) {
    $remainingItems += 'corrigir falhas do gate real de staging antes da macro 5'
}

if (-not $stage4Report.evidence.workflowRunUrl) {
    $remainingItems += 'registrar link do workflow/artifact da rodada real'
}

$handoffReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    macroStage = [ordered]@{
        completed = if ($macro5Ready) { 4 } else { 3 }
        current = if ($macro5Ready) { 5 } else { 4 }
        total = 5
    }
    status = [ordered]@{
        macro4Completed = $macro5Ready
        macro5Ready = $macro5Ready
        configValidated = $configValidated
        validateOnly = $validateOnly
        rolloutPassed = $stage4Passed
    }
    environment = $stage4Report.environment
    evidence = [ordered]@{
        stage4Report = $Stage4ReportPath
        stage4Markdown = Get-MarkdownPath -JsonPath $Stage4ReportPath
        gateReport = $stage4Report.evidence.gateReport
        gateSummary = $stage4Report.evidence.gateSummary
        workflowRunUrl = $stage4Report.evidence.workflowRunUrl
    }
    macro4 = [ordered]@{
        title = 'Validacao em staging e proxy real'
        completedItems = $stage4Report.summary.completedItems
        remainingItems = $remainingItems
    }
    macro5 = [ordered]@{
        title = 'Corte final e Google Search Console'
        canStart = $macro5Ready
        nextSteps = @(
            'executar production gate com dominio final',
            'confirmar robots e sitemaps no dominio canonico',
            'submeter sitemap.xml e question-sitemap.xml no Google Search Console',
            'acompanhar canonicals, cobertura e rich results nos primeiros dias'
        )
        references = @(
            'docs/GOOGLE_SEARCH_CONSOLE.md',
            'docs/WEB_NEXT_CUTOVER.md',
            '.github/workflows/web-next-stage4-rollout.yml'
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
    '# Web Next Stage 4 Handoff',
    '',
    "- Gerado em: $($handoffReport.generatedAt)",
    "- Macro 4 concluida: $($handoffReport.status.macro4Completed)",
    "- Macro 5 pronta para iniciar: $($handoffReport.status.macro5Ready)",
    "- Ambiente: $($stage4Report.environment.name)",
    "- URL Next: $($stage4Report.environment.baseUrl)",
    "- Canonical esperado: $($stage4Report.environment.expectedCanonicalBaseUrl)",
    '',
    '## Evidencias',
    '',
    "- Relatorio macro 4: $Stage4ReportPath",
    "- Relatorio gate: $($stage4Report.evidence.gateReport)",
    "- Resumo gate: $($stage4Report.evidence.gateSummary)",
    "- Workflow: $(if ($stage4Report.evidence.workflowRunUrl) { $stage4Report.evidence.workflowRunUrl } else { 'n/a' })",
    '',
    '## Pendencias',
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

$markdownLines += @(
    '',
    '## Macro 5',
    '',
    '- Executar production gate com dominio final',
    '- Confirmar robots e sitemaps no dominio canonico',
    '- Submeter sitemap.xml e question-sitemap.xml no Google Search Console',
    '- Acompanhar canonicals, cobertura e rich results nos primeiros dias'
)

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] stage 4 handoff report - $OutputPath"
Write-Host "[OK] stage 4 handoff markdown - $markdownPath"

if (-not $macro5Ready) {
    exit 1
}

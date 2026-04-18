param(
    [Parameter(Mandatory = $true)]
    [string]$ProxyConfigPath,
    [ValidateSet('hybrid', 'next-only')]
    [string]$ProxyMode = 'hybrid',
    [string]$OutputPath = 'docs/reports/web-next-stage4-proxy-check-latest.json'
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

function Get-RoutePattern {
    param(
        [string]$Route
    )

    $escaped = [regex]::Escape($Route)
    return $escaped.Replace('\.', '\\?\.')
}

function Test-RoutePresence {
    param(
        [string]$Content,
        [string]$Route
    )

    $pattern = Get-RoutePattern -Route $Route
    return $Content -match $pattern
}

function Test-RouteTokenPresence {
    param(
        [string]$Content,
        [string]$Token
    )

    $pattern = "(?<![A-Za-z0-9_-])$([regex]::Escape($Token))(?![A-Za-z0-9_-])"
    return $Content -match $pattern
}

if ($ProxyConfigPath -match '^https?://') {
    throw 'Remote proxy config URLs cannot be checked locally. Use a local copy for stage 4 proxy validation.'
}

if (-not (Test-Path -LiteralPath $ProxyConfigPath)) {
    throw "Proxy config not found: $ProxyConfigPath"
}

$rawContent = Get-Content -LiteralPath $ProxyConfigPath -Raw
$normalizedContent = $rawContent -replace "`r`n", "`n"

$requiredExactRoutes = @(
    '/',
    '/robots.txt',
    '/sitemap.xml',
    '/question-sitemap.xml',
    '/question-sitemap-page.xml',
    '/planos',
    '/plans',
    '/elite',
    '/faq',
    '/changelog',
    '/privacy',
    '/terms',
    '/checkout/termos-de-adesao'
)

$requiredDynamicRouteTokens = @(
    'l',
    'question',
    'ranking',
    'material',
    'promo'
)

$optionalHybridRouteTokens = @(
    'auth',
    'dashboard',
    'practice',
    'admin',
    'profile',
    'checkout'
)

$exactResults = foreach ($route in $requiredExactRoutes) {
    $singleSegmentToken = $route.Trim('/')
    $present = [bool](Test-RoutePresence -Content $normalizedContent -Route $route)

    if (-not $present -and $singleSegmentToken -and $singleSegmentToken -notmatch '/') {
        $present = [bool](Test-RouteTokenPresence -Content $normalizedContent -Token $singleSegmentToken)
    }

    [ordered]@{
        route = $route
        present = $present
    }
}

$dynamicResults = foreach ($token in $requiredDynamicRouteTokens) {
    [ordered]@{
        token = $token
        present = [bool](Test-RouteTokenPresence -Content $normalizedContent -Token $token)
    }
}

$hybridResults = foreach ($token in $optionalHybridRouteTokens) {
    [ordered]@{
        token = $token
        present = [bool](Test-RouteTokenPresence -Content $normalizedContent -Token $token)
    }
}

$missingExactRoutes = @($exactResults | Where-Object { -not $_.present } | ForEach-Object { $_.route })
$missingDynamicTokens = @($dynamicResults | Where-Object { -not $_.present } | ForEach-Object { $_.token })
$missingHybridTokens = @($hybridResults | Where-Object { -not $_.present } | ForEach-Object { $_.token })

$warnings = @()
if ($ProxyMode -eq 'hybrid' -and $missingHybridTokens.Count -gt 0) {
    $warnings += "Hybrid proxy reference does not mention these SPA handoff tokens: $($missingHybridTokens -join ', ')"
}

$passed = $missingExactRoutes.Count -eq 0 -and $missingDynamicTokens.Count -eq 0

$report = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    proxyConfigPath = $ProxyConfigPath
    proxyMode = $ProxyMode
    passed = $passed
    summary = [ordered]@{
        requiredExactRoutes = $requiredExactRoutes.Count
        missingExactRoutes = $missingExactRoutes.Count
        requiredDynamicTokens = $requiredDynamicRouteTokens.Count
        missingDynamicTokens = $missingDynamicTokens.Count
        warnings = $warnings.Count
    }
    checks = [ordered]@{
        exactRoutes = $exactResults
        dynamicTokens = $dynamicResults
        hybridTokens = $hybridResults
    }
    missing = [ordered]@{
        exactRoutes = $missingExactRoutes
        dynamicTokens = $missingDynamicTokens
        hybridTokens = $missingHybridTokens
    }
    warnings = $warnings
}

$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory) {
    New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
}

$report | ConvertTo-Json -Depth 100 | Set-Content -LiteralPath $OutputPath -Encoding utf8

$markdownPath = Get-MarkdownPath -JsonPath $OutputPath
$markdownLines = @(
    '# Web Next Stage 4 Proxy Check',
    '',
    "- Gerado em: $($report.generatedAt)",
    "- Proxy config: $ProxyConfigPath",
    "- Proxy mode: $ProxyMode",
    "- Status: $(if ($passed) { 'passed' } else { 'failed' })",
    '',
    '## Totais',
    '',
    "- Rotas exatas obrigatorias: $($report.summary.requiredExactRoutes)",
    "- Rotas exatas ausentes: $($report.summary.missingExactRoutes)",
    "- Tokens dinamicos obrigatorios: $($report.summary.requiredDynamicTokens)",
    "- Tokens dinamicos ausentes: $($report.summary.missingDynamicTokens)",
    "- Avisos: $($report.summary.warnings)"
)

if ($missingExactRoutes.Count -gt 0) {
    $markdownLines += @(
        '',
        '## Rotas exatas ausentes',
        ''
    )

    foreach ($route in $missingExactRoutes) {
        $markdownLines += "- $route"
    }
}

if ($missingDynamicTokens.Count -gt 0) {
    $markdownLines += @(
        '',
        '## Tokens dinamicos ausentes',
        ''
    )

    foreach ($token in $missingDynamicTokens) {
        $markdownLines += "- $token"
    }
}

if ($warnings.Count -gt 0) {
    $markdownLines += @(
        '',
        '## Avisos',
        ''
    )

    foreach ($warning in $warnings) {
        $markdownLines += "- $warning"
    }
}

$markdownLines | Set-Content -LiteralPath $markdownPath -Encoding utf8

Write-Host "[OK] stage 4 proxy check report - $OutputPath"
Write-Host "[OK] stage 4 proxy check markdown - $markdownPath"

if (-not $passed) {
    exit 1
}

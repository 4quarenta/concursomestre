param(
    [string]$WorkDirectory = ''
)

$ErrorActionPreference = 'Stop'

if (-not $WorkDirectory) {
    $WorkDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "web-next-stage4-smoke-$([Guid]::NewGuid().ToString('N'))"
}

function Invoke-CheckedStep {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments
    )

    Write-Host "[RUN] $Name"
    & powershell -ExecutionPolicy Bypass -File $FilePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "Stage 4 smoke step failed: $Name"
    }
}

function Invoke-ExpectedFailureStep {
    param(
        [string]$Name,
        [string]$FilePath,
        [string[]]$Arguments
    )

    Write-Host "[RUN] $Name"
    $previousErrorActionPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & powershell -ExecutionPolicy Bypass -File $FilePath @Arguments 1>$null 2>$null
        $exitCode = $LASTEXITCODE
    }
    finally {
        $ErrorActionPreference = $previousErrorActionPreference
    }

    if ($exitCode -eq 0) {
        throw "Stage 4 smoke step should have failed: $Name"
    }

    Write-Host "[OK] expected failure - $Name"
}

New-Item -ItemType Directory -Force -Path $WorkDirectory | Out-Null

$nginxProxyReportPath = Join-Path $WorkDirectory 'proxy-nginx.json'
$apacheProxyReportPath = Join-Path $WorkDirectory 'proxy-apache.json'
$rolloutConfigPath = Join-Path $WorkDirectory 'web-next-stage4-rollout.local.json'
$rolloutReportPath = Join-Path $WorkDirectory 'web-next-stage4-rollout.json'
$statusReportPath = Join-Path $WorkDirectory 'web-next-stage4-status.json'
$readinessReportPath = Join-Path $WorkDirectory 'web-next-stage4-readiness.json'
$placeholderConfigPath = Join-Path $WorkDirectory 'web-next-stage4-placeholder.local.json'

Invoke-CheckedStep `
    -Name 'proxy check nginx example' `
    -FilePath 'scripts/checks/run-web-next-stage4-proxy-check.ps1' `
    -Arguments @(
        '-ProxyConfigPath', 'docs/examples/nginx-web-next-cutover.conf',
        '-ProxyMode', 'hybrid',
        '-OutputPath', $nginxProxyReportPath
    )

Invoke-CheckedStep `
    -Name 'proxy check apache example' `
    -FilePath 'scripts/checks/run-web-next-stage4-proxy-check.ps1' `
    -Arguments @(
        '-ProxyConfigPath', 'docs/examples/apache-web-next-cutover.conf',
        '-ProxyMode', 'hybrid',
        '-OutputPath', $apacheProxyReportPath
    )

Invoke-CheckedStep `
    -Name 'init rollout config' `
    -FilePath 'scripts/checks/new-web-next-stage4-rollout-config.ps1' `
    -Arguments @(
        '-OutputPath', $rolloutConfigPath,
        '-BaseUrl', 'https://staging.concursomestre.test',
        '-LegacyWebBaseUrl', 'https://app.staging.concursomestre.test',
        '-QuestionId', 'question-9001',
        '-RankingId', 'ranking-9001',
        '-MaterialId', 'material-9001',
        '-Notes', 'stage 4 smoke test',
        '-Force'
    )

Invoke-ExpectedFailureStep `
    -Name 'reject placeholder rollout config' `
    -FilePath 'scripts/checks/new-web-next-stage4-rollout-config.ps1' `
    -Arguments @(
        '-OutputPath', $placeholderConfigPath,
        '-BaseUrl', 'https://staging.seu-dominio.com',
        '-LegacyWebBaseUrl', 'https://app.staging.seu-dominio.com',
        '-QuestionId', '123',
        '-RankingId', 'abc',
        '-MaterialId', 'xyz',
        '-Force'
    )

Invoke-CheckedStep `
    -Name 'config check with integrated proxy check' `
    -FilePath 'scripts/checks/run-web-next-stage4-rollout.ps1' `
    -Arguments @(
        '-ConfigPath', $rolloutConfigPath,
        '-OutputPath', $rolloutReportPath,
        '-ValidateOnly'
    )

Invoke-CheckedStep `
    -Name 'stage 4 status after config check' `
    -FilePath 'scripts/checks/run-web-next-stage4-status.ps1' `
    -Arguments @(
        '-ConfigPath', $rolloutConfigPath,
        '-RolloutReportPath', $rolloutReportPath,
        '-OutputPath', $statusReportPath
    )

$statusReport = Get-Content -LiteralPath $statusReportPath -Raw | ConvertFrom-Json
if ([string]$statusReport.status.state -ne 'config-validated') {
    throw "Expected stage 4 smoke status config-validated, got $($statusReport.status.state)"
}

if (-not [bool]$statusReport.evidence.proxyCheckReportExists) {
    throw 'Expected stage 4 smoke status to include an existing proxy check report.'
}

Invoke-ExpectedFailureStep `
    -Name 'readiness stays closed before real rollout' `
    -FilePath 'scripts/checks/run-web-next-stage4-status.ps1' `
    -Arguments @(
        '-ConfigPath', $rolloutConfigPath,
        '-RolloutReportPath', $rolloutReportPath,
        '-OutputPath', $readinessReportPath,
        '-RequireMacro5Ready'
    )

$smokeReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    passed = $true
    workDirectory = $WorkDirectory
    evidence = [ordered]@{
        nginxProxyReport = $nginxProxyReportPath
        apacheProxyReport = $apacheProxyReportPath
        rolloutConfig = $rolloutConfigPath
        rolloutReport = $rolloutReportPath
        statusReport = $statusReportPath
        readinessReport = $readinessReportPath
    }
}

$smokeReportPath = Join-Path $WorkDirectory 'web-next-stage4-smoke.json'
$smokeReport | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $smokeReportPath -Encoding utf8

Write-Host "[OK] stage 4 smoke passed - $smokeReportPath"

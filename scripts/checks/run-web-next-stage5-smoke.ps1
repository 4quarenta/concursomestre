param(
    [string]$WorkDirectory = ''
)

$ErrorActionPreference = 'Stop'

if (-not $WorkDirectory) {
    $WorkDirectory = Join-Path ([System.IO.Path]::GetTempPath()) "web-next-stage5-smoke-$([Guid]::NewGuid().ToString('N'))"
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
        throw "Stage 5 smoke step failed: $Name"
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
        throw "Stage 5 smoke step should have failed: $Name"
    }

    Write-Host "[OK] expected failure - $Name"
}

New-Item -ItemType Directory -Force -Path $WorkDirectory | Out-Null

$configPath = Join-Path $WorkDirectory 'web-next-stage5-launch.local.json'
$placeholderConfigPath = Join-Path $WorkDirectory 'web-next-stage5-placeholder.local.json'
$validateReportPath = Join-Path $WorkDirectory 'web-next-stage5-launch.json'
$statusReportPath = Join-Path $WorkDirectory 'web-next-stage5-status.json'
$readinessReportPath = Join-Path $WorkDirectory 'web-next-stage5-readiness.json'

Invoke-CheckedStep `
    -Name 'init stage 5 launch config' `
    -FilePath 'scripts/checks/new-web-next-stage5-launch-config.ps1' `
    -Arguments @(
        '-OutputPath', $configPath,
        '-BaseUrl', 'https://concursomestre.test',
        '-LegacyWebBaseUrl', 'https://app.concursomestre.test',
        '-QuestionId', 'question-9001',
        '-RankingId', 'ranking-9001',
        '-MaterialId', 'material-9001',
        '-SearchConsoleProperty', 'sc-domain:concursomestre.test',
        '-MonitoringNotes', 'monitorar cobertura, canonicals e rich results',
        '-Force'
    )

Invoke-ExpectedFailureStep `
    -Name 'reject placeholder stage 5 config' `
    -FilePath 'scripts/checks/new-web-next-stage5-launch-config.ps1' `
    -Arguments @(
        '-OutputPath', $placeholderConfigPath,
        '-BaseUrl', 'https://producao.exemplo.com',
        '-LegacyWebBaseUrl', 'https://app.producao.exemplo.com',
        '-QuestionId', '123',
        '-RankingId', 'abc',
        '-MaterialId', 'xyz',
        '-SearchConsoleProperty', 'sc-domain:exemplo.com',
        '-Force'
    )

Invoke-CheckedStep `
    -Name 'validate stage 5 launch config' `
    -FilePath 'scripts/checks/run-web-next-stage5-launch.ps1' `
    -Arguments @(
        '-ConfigPath', $configPath,
        '-OutputPath', $validateReportPath,
        '-ValidateOnly'
    )

Invoke-CheckedStep `
    -Name 'stage 5 status after validate only' `
    -FilePath 'scripts/checks/run-web-next-stage5-status.ps1' `
    -Arguments @(
        '-ConfigPath', $configPath,
        '-LaunchReportPath', $validateReportPath,
        '-OutputPath', $statusReportPath
    )

$statusReport = Get-Content -LiteralPath $statusReportPath -Raw | ConvertFrom-Json
if ([string]$statusReport.status.state -ne 'config-validated') {
    throw "Expected stage 5 smoke status config-validated, got $($statusReport.status.state)"
}

Invoke-ExpectedFailureStep `
    -Name 'stage 5 readiness stays closed before production gate' `
    -FilePath 'scripts/checks/run-web-next-stage5-status.ps1' `
    -Arguments @(
        '-ConfigPath', $configPath,
        '-LaunchReportPath', $validateReportPath,
        '-OutputPath', $readinessReportPath,
        '-RequireCompleted'
    )

$smokeReport = [ordered]@{
    generatedAt = [DateTime]::UtcNow.ToString('o')
    passed = $true
    workDirectory = $WorkDirectory
    evidence = [ordered]@{
        config = $configPath
        validateReport = $validateReportPath
        statusReport = $statusReportPath
        readinessReport = $readinessReportPath
    }
}

$smokeReportPath = Join-Path $WorkDirectory 'web-next-stage5-smoke.json'
$smokeReport | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $smokeReportPath -Encoding utf8

Write-Host "[OK] stage 5 smoke passed - $smokeReportPath"

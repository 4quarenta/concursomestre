param(
    [string]$FrontendRoot = 'C:\dev\concursomestre',
    [string]$BackendRoot = 'C:\xampp\htdocs\questao-pro-backend',
    [string]$PhpExe = 'C:\xampp\php\php.exe',
    [string]$WebNextBaseUrl = 'http://localhost:3001',
    [string]$LegacyWebBaseUrl = 'http://localhost:3000',
    [switch]$SkipLegacyBridgeChecks,
    [switch]$SkipWebNextHttpChecks
)

$ErrorActionPreference = 'Stop'

function Invoke-Step {
    param(
        [string]$Label,
        [scriptblock]$Action
    )

    Write-Output "STEP|$Label|START"
    $global:LASTEXITCODE = 0
    & $Action
    if ($LASTEXITCODE -ne 0) {
        throw ("Step failed with exit code {0}: {1}" -f $LASTEXITCODE, $Label)
    }
    Write-Output "STEP|$Label|OK"
}

function Invoke-PhpTest {
    param([string]$TestPath)
    & $PhpExe $TestPath
    if ($LASTEXITCODE -ne 0) {
        throw "PHP test failed: $TestPath"
    }
}

function Test-UrlReachable {
    param([string]$Url)

    try {
        $response = Invoke-WebRequest $Url -UseBasicParsing -TimeoutSec 10
        return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
    }
    catch {
        return $false
    }
}

Push-Location $FrontendRoot

try {
    Invoke-Step 'headers:verify' {
        powershell -ExecutionPolicy Bypass -File (Join-Path $FrontendRoot 'scripts\checks\verify-standard-file-header.ps1') -IncludeBackend 0
    }
    Invoke-Step 'frontend:test:admin' { npm run test:admin }
    Invoke-Step 'frontend:test:auth' { npm run test:auth }
    Invoke-Step 'frontend:build' { npm run build }
    Invoke-Step 'web-next:typecheck' { npm run web-next:typecheck }
    Invoke-Step 'web-next:build' { npm run web-next:build }

    if (-not $SkipWebNextHttpChecks) {
        if (Test-UrlReachable -Url $WebNextBaseUrl) {
            Invoke-Step 'web-next:cutover-check' {
                $previousBaseUrl = $env:WEB_NEXT_BASE_URL
                $env:WEB_NEXT_BASE_URL = $WebNextBaseUrl

                try {
                    npm run web-next:cutover-check
                }
                finally {
                    if ($null -eq $previousBaseUrl) {
                        Remove-Item Env:WEB_NEXT_BASE_URL -ErrorAction SilentlyContinue
                    }
                    else {
                        $env:WEB_NEXT_BASE_URL = $previousBaseUrl
                    }
                }
            }

            if (-not $SkipLegacyBridgeChecks) {
                if (Test-UrlReachable -Url $LegacyWebBaseUrl) {
                    Invoke-Step 'web-next:legacy-bridge-check' {
                        $previousWebNextBaseUrl = $env:WEB_NEXT_BASE_URL
                        $previousLegacyBaseUrl = $env:WEB_LEGACY_BASE_URL
                        $env:WEB_NEXT_BASE_URL = $WebNextBaseUrl
                        $env:WEB_LEGACY_BASE_URL = $LegacyWebBaseUrl

                        try {
                            npm run web-next:legacy-bridge-check
                        }
                        finally {
                            if ($null -eq $previousWebNextBaseUrl) {
                                Remove-Item Env:WEB_NEXT_BASE_URL -ErrorAction SilentlyContinue
                            }
                            else {
                                $env:WEB_NEXT_BASE_URL = $previousWebNextBaseUrl
                            }

                            if ($null -eq $previousLegacyBaseUrl) {
                                Remove-Item Env:WEB_LEGACY_BASE_URL -ErrorAction SilentlyContinue
                            }
                            else {
                                $env:WEB_LEGACY_BASE_URL = $previousLegacyBaseUrl
                            }
                        }
                    }
                }
                else {
                    Write-Output "STEP|web-next:legacy-bridge-check|SKIP|Unreachable legacy base URL: $LegacyWebBaseUrl"
                }
            }
        }
        else {
            Write-Output "STEP|web-next:cutover-check|SKIP|Unreachable base URL: $WebNextBaseUrl"
        }
    }

    if (Test-Path (Join-Path $FrontendRoot 'dist')) {
        Remove-Item (Join-Path $FrontendRoot 'dist') -Recurse -Force
    }

    Invoke-Step 'backend:api-residual-surface' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\ApiResidualSurfaceWiringTest.php') }
    Invoke-Step 'backend:api-bridge-inventory' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\ApiBridgeInventoryWiringTest.php') }
    Invoke-Step 'backend:api-thin-bridges' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\ApiThinBridgesWiringTest.php') }
    Invoke-Step 'backend:api-exceptional-bridges' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\ApiExceptionalBridgesWiringTest.php') }
    Invoke-Step 'backend:api-accepted-exceptions' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\ApiAcceptedExceptionsWiringTest.php') }
    Invoke-Step 'backend:settings-module' { Invoke-PhpTest (Join-Path $BackendRoot 'tests\SettingsModuleWiringTest.php') }

    Invoke-Step 'smoke:home' {
        $status = (Invoke-WebRequest 'http://localhost:3000/#/' -UseBasicParsing -TimeoutSec 15).StatusCode
        if ($status -ne 200) {
            throw "Unexpected home status: $status"
        }
        Write-Output "HOME_STATUS|$status"
    }

    Write-Output 'TRANSITION_READY|OK'
}
finally {
    Pop-Location
}

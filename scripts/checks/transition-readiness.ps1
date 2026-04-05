param(
    [string]$FrontendRoot = 'C:\dev\concursomestre',
    [string]$BackendRoot = 'C:\xampp\htdocs\questao-pro-backend',
    [string]$PhpExe = 'C:\xampp\php\php.exe'
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

Push-Location $FrontendRoot

try {
    Invoke-Step 'headers:verify' { npm run test:headers }
    Invoke-Step 'frontend:test:admin' { npm run test:admin }
    Invoke-Step 'frontend:test:auth' { npm run test:auth }
    Invoke-Step 'frontend:build' { npm run build }

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

param(
    [string]$WebNextBaseUrl = 'http://localhost:3001',
    [string]$LegacyWebBaseUrl = 'http://localhost:3000',
    [string]$ExpectedCanonicalBaseUrl = ''
)

$ErrorActionPreference = 'Stop'

$previousWebNextBaseUrl = $env:WEB_NEXT_BASE_URL
$previousLegacyBaseUrl = $env:WEB_LEGACY_BASE_URL
$previousExpectedCanonicalBaseUrl = $env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL

$env:WEB_NEXT_BASE_URL = $WebNextBaseUrl
$env:WEB_LEGACY_BASE_URL = $LegacyWebBaseUrl

if ($ExpectedCanonicalBaseUrl) {
    $env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL = $ExpectedCanonicalBaseUrl
}
else {
    Remove-Item Env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL -ErrorAction SilentlyContinue
}

try {
    npm run web-next:cutover-check
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }

    npm run web-next:legacy-bridge-check
    if ($LASTEXITCODE -ne 0) {
        exit $LASTEXITCODE
    }
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

    if ($null -eq $previousExpectedCanonicalBaseUrl) {
        Remove-Item Env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL -ErrorAction SilentlyContinue
    }
    else {
        $env:WEB_NEXT_EXPECTED_CANONICAL_BASE_URL = $previousExpectedCanonicalBaseUrl
    }
}

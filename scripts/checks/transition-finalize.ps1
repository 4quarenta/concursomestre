param(
    [string]$FrontendRoot = 'C:\dev\concursomestre'
)

$ErrorActionPreference = 'Stop'

$pagesDir = Join-Path $FrontendRoot 'src\pages'
$removeScript = Join-Path $FrontendRoot 'scripts\checks\remove-empty-pages-dir.ps1'
$lockFinderScript = Join-Path $FrontendRoot 'scripts\checks\find-locking-process.ps1'

function Write-LikelyWorkspaceProcesses {
    param([string]$WorkspaceRoot)

    $escapedRoot = [Regex]::Escape($WorkspaceRoot)
    $escapedPagesDir = [Regex]::Escape((Join-Path $WorkspaceRoot 'src\pages'))

    $candidates = Get-CimInstance Win32_Process |
        Where-Object {
            if (-not $_.CommandLine) {
                return $false
            }

            if ($_.CommandLine -match $escapedRoot) {
                return $true
            }

            if ($_.CommandLine -match 'vite') {
                return $true
            }

            if ($_.CommandLine -match 'Code\.exe') {
                return $true
            }

            return $false
        } |
        Select-Object ProcessId, Name, ExecutablePath, CommandLine

    $candidateRows = foreach ($candidate in $candidates) {
        $rawCommandLine = ''
        if ($null -ne $candidate.CommandLine) {
            $rawCommandLine = [string]$candidate.CommandLine
        }

        $commandLine = $rawCommandLine -replace '\s+', ' '
        $score = 0

        if ($commandLine -match $escapedPagesDir) {
            $score = 3
        }
        elseif ($commandLine -match $escapedRoot) {
            $score = 2
        }
        elseif ($commandLine -match 'vite|Code\.exe') {
            $score = 1
        }

        [PSCustomObject]@{
            ProcessId = $candidate.ProcessId
            Name = $candidate.Name
            CommandLine = $commandLine.Trim()
            Score = $score
        }
    }

    $sortedCandidates = $candidateRows | Sort-Object -Property @{ Expression = 'Score'; Descending = $true }, ProcessId
    $primaryCandidate = $sortedCandidates | Select-Object -First 1

    if ($primaryCandidate -and $primaryCandidate.Score -gt 0) {
        Write-Output ("TRANSITION_FINALIZE_PRIMARY_CANDIDATE|{0}|{1}|score={2}|{3}" -f $primaryCandidate.ProcessId, $primaryCandidate.Name, $primaryCandidate.Score, $primaryCandidate.CommandLine)
    }

    foreach ($candidateRow in $sortedCandidates) {
        Write-Output ("TRANSITION_FINALIZE_CANDIDATE|{0}|{1}|score={2}|{3}" -f $candidateRow.ProcessId, $candidateRow.Name, $candidateRow.Score, $candidateRow.CommandLine)
    }
}

if (Test-Path $pagesDir) {
    $removeResult = powershell -ExecutionPolicy Bypass -File $removeScript

    if ($LASTEXITCODE -ne 0) {
        if (Test-Path $lockFinderScript) {
            $lockDetails = powershell -ExecutionPolicy Bypass -File $lockFinderScript -Path $pagesDir 2>$null
            if ($lockDetails) {
                $lockDetails | ForEach-Object {
                    if ($_ -is [string]) {
                        Write-Output "TRANSITION_FINALIZE_LOCK_DETAIL|$_"
                    } else {
                        $json = $_ | ConvertTo-Json -Compress
                        Write-Output "TRANSITION_FINALIZE_LOCK_DETAIL|$json"
                    }
                }
            }
        }

        Write-LikelyWorkspaceProcesses -WorkspaceRoot $FrontendRoot
        Write-Output "TRANSITION_FINALIZE|BLOCKED|$removeResult"
        exit 1
    }
}

if (Test-Path $pagesDir) {
    Write-Output "TRANSITION_FINALIZE|BLOCKED|Directory still exists: $pagesDir"
    exit 1
}

Push-Location $FrontendRoot

try {
    npm run test:transition

    if ($LASTEXITCODE -ne 0) {
        Write-Output 'TRANSITION_FINALIZE|FAILED|test:transition'
        exit 1
    }

    Write-Output 'TRANSITION_FINALIZE|OK'
}
finally {
    Pop-Location
}

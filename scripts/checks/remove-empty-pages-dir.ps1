param(
    [string]$Path = 'C:\dev\concursomestre\src\pages'
)

$targetPath = (Resolve-Path -LiteralPath $Path -ErrorAction Stop).Path
$entries = @(Get-ChildItem -LiteralPath $targetPath -Force -ErrorAction SilentlyContinue)

if ($entries.Count -gt 0) {
    Write-Output "NOT_EMPTY|$targetPath|$($entries.Count)"
    exit 1
}

try {
    Remove-Item -LiteralPath $targetPath -Force -ErrorAction Stop
    Write-Output "REMOVED|$targetPath"
    exit 0
}
catch {
    Write-Output "LOCKED|$targetPath|$($_.Exception.Message)"
    exit 1
}

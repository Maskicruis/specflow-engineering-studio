param([Parameter(Mandatory=$true)][string]$PidFile)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $PidFile)) { exit 0 }
$owned = Get-Content -LiteralPath $PidFile -Raw -Encoding UTF8 | ConvertFrom-Json
$process = Get-Process -Id ([int]$owned.id) -ErrorAction SilentlyContinue
if (-not $process) { exit 0 }
if ($process.ProcessName -ne 'WINWORD' -or $process.StartTime.ToUniversalTime().Ticks -ne [long]$owned.startedAt) { exit 0 }
# Only the verified Word process created for this job, never all Word instances.
Stop-Process -Id $process.Id -Force

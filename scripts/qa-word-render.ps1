param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputPdf)
$ErrorActionPreference='Stop'
$word=$null; $doc=$null
$baseline=@(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object {$_.Id})
try {
    $word=New-Object -ComObject Word.Application
    $owned=@(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object {$baseline -notcontains $_.Id})
    if ($owned.Count -ne 1) { $word=$null; throw 'Unable to identify the private rendering instance.' }
    [IO.File]::WriteAllText(($OutputPdf+'.pid'),(@{id=$owned[0].Id;startedAt=$owned[0].StartTime.ToUniversalTime().Ticks}|ConvertTo-Json -Compress))
    $word.Visible=$false; $word.DisplayAlerts=0; $word.AutomationSecurity=3
    $doc=$word.Documents.Open([string]$InputFile,$false,$true,$false)
    $doc.ExportAsFixedFormat([string]$OutputPdf,17)
    [Console]::WriteLine('Exported Word PDF: '+$OutputPdf)
} finally {
    if ($doc) { try {$doc.Close([ref][int]0)} catch {} }
    if ($word) { try {$word.NormalTemplate.Saved=$true; $word.Quit([ref][int]0)} catch {}; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

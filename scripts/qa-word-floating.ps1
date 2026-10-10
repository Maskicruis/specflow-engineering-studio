param([Parameter(Mandatory=$true)][string]$InputFile,[Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference='Stop'
$word=$null; $doc=$null
$baseline=@(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object {$_.Id})
try {
    $word=New-Object -ComObject Word.Application
    $owned=@(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object {$baseline -notcontains $_.Id})
    if ($owned.Count -ne 1) { $word=$null; throw 'Cannot verify private Word instance.' }
    $word.Visible=$false; $word.DisplayAlerts=0; $word.AutomationSecurity=3
    $doc=$word.Documents.Open([string]$InputFile,$false,$false,$false)
    $null=$doc.InlineShapes.Item(1).ConvertToShape()
    if ($doc.Shapes.Count -ne 1) { throw 'Floating picture fixture failed.' }
    $doc.SaveAs2([ref][string]$OutputFile,[ref][int]12)
    [Console]::WriteLine('Synthetic floating picture fixture ready.')
} finally {
    if ($doc) { try {$doc.Close([ref][int]0)} catch {} }
    if ($word) { try {$word.NormalTemplate.Saved=$true; $word.Quit([ref][int]0)} catch {}; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

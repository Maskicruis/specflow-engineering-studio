param([Parameter(Mandatory=$true)][string]$InputFile, [Parameter(Mandatory=$true)][string]$OutputFile)
$ErrorActionPreference = 'Stop'
$word = $null; $doc = $null
$baseline = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
try {
    $word = New-Object -ComObject Word.Application
    $owned = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $baseline -notcontains $_.Id })
    if ($owned.Count -ne 1) { $word = $null; throw 'Cannot verify private Word instance.' }
    $word.Visible = $false; $word.DisplayAlerts = 0; $word.AutomationSecurity = 3
    $doc = $word.Documents.Open([string]$InputFile, $false, $false, $false)
    if ($doc.TablesOfContents.Count -ne 1) { throw 'Expected one native TOC.' }
    $toc = $doc.TablesOfContents.Item(1)
    if ($toc.Range.Hyperlinks.Count -lt 3) { throw 'TOC does not have linked heading entries.' }
    $headingStyle = [string][char]0x6837 + [string][char]0x5F0F + '1'
    $end = [int]$doc.Content.End - 1
    $range = $doc.Range($end, $end)
    $range.InsertBefore("`rQA added heading`r")
    $added = $doc.Paragraphs.Item($doc.Paragraphs.Count - 1)
    $added.Range.Style = $headingStyle
    $toc.Update(); $doc.Repaginate(); $toc.UpdatePageNumbers()
    if (-not $toc.Range.Text.Contains('QA added heading')) { throw 'TOC failed to refresh after a new heading.' }
    $doc.SaveAs2([ref][string]$OutputFile, [ref][int]12)
    [Console]::WriteLine('PASS: native TOC contains linked headings and refreshes after a newly added heading without macros.')
} finally {
    if ($doc) { try { $doc.Close([ref][int]0) } catch {} }
    if ($word) { try { $word.NormalTemplate.Saved = $true; $word.Quit([ref][int]0) } catch {}; [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word) }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

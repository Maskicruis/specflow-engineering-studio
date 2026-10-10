param([Parameter(Mandatory=$true)][string]$RequestFile)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false)
$request = Get-Content -LiteralPath $RequestFile -Raw -Encoding UTF8 | ConvertFrom-Json
$word = $null
$document = $null
$ownedWordPid = 0
$previousUpdateLinks = $null
$baselineWordPids = @(Get-Process WINWORD -ErrorAction SilentlyContinue | ForEach-Object { $_.Id })
$sectionEnds = @()
$floatingAnchors = @()

function Emit-WordEvent($value) { [Console]::WriteLine(($value | ConvertTo-Json -Depth 14 -Compress)) }
function Save-WordResult($value) {
    $json = $value | ConvertTo-Json -Depth 16
    [IO.File]::WriteAllText($request.resultPath, $json, (New-Object Text.UTF8Encoding($false)))
}
function Paragraph-Info($paragraph, [int]$index) {
    $range = $paragraph.Range
    $text = $range.Text.TrimEnd([char]13, [char]7)
    $style = ''
    try { $style = [string]$range.Style.NameLocal } catch {}
    $floating = @($floatingAnchors | Where-Object { $_ -ge $range.Start -and $_ -lt $range.End }).Count
    $unsafe = $range.Fields.Count -gt 0 -or $range.InlineShapes.Count -gt 0 -or $range.OMaths.Count -gt 0 -or $range.Revisions.Count -gt 0 -or $floating -gt 0
    $hasSection = @($sectionEnds | Where-Object { $_ -ge $range.Start -and $_ -lt $range.End }).Count -gt 0
    return @{ index=$index; text=$text; start=[int]$range.Start; end=[int]$range.End; page=[int]$range.Information(3); breakBefore=([int]$range.ParagraphFormat.PageBreakBefore -eq -1); breakAfter=$text.Contains([string][char]12); sectionBreak=$hasSection; pictures=([int]$range.InlineShapes.Count + $floating); outlineLevel=[int]$paragraph.OutlineLevel; style=$style; inTable=[bool]$range.Information(12); editable=(-not $unsafe -and $text.Length -le 2000) }
}
function Mark-LayoutRange($part, [string]$name) {
    if ($null -eq $part) { return }
    $first = $document.Paragraphs.Item([int]$part.first)
    $last = $document.Paragraphs.Item([int]$part.last)
    if ($first.Range.Text.TrimEnd([char]13, [char]7) -cne [string]$part.firstText -or $last.Range.Text.TrimEnd([char]13, [char]7) -cne [string]$part.lastText) { throw 'Front matter changed since review. Inspect the document again.' }
    $range = $document.Range([int]$part.start, [int]$part.end)
    $null = $document.Bookmarks.Add($name, $range)
}

try {
    $word = New-Object -ComObject Word.Application
    $newProcesses = @(Get-Process WINWORD -ErrorAction SilentlyContinue | Where-Object { $baselineWordPids -notcontains $_.Id })
    if ($newProcesses.Count -ne 1) { $word = $null; throw 'Could not verify an isolated Word instance. Close other automation tasks and retry.' }
    $ownedWordPid = [int]$newProcesses[0].Id
    if ($request.pidPath) { [IO.File]::WriteAllText($request.pidPath, (@{id=$ownedWordPid; startedAt=$newProcesses[0].StartTime.ToUniversalTime().Ticks} | ConvertTo-Json -Compress)) }
    $word.Visible = [bool]$request.debugVisible
    $word.DisplayAlerts = 0
    $word.AutomationSecurity = 3 # Never run macros from uploaded input documents.
    $previousUpdateLinks = $word.Options.UpdateLinksAtOpen
    $word.Options.UpdateLinksAtOpen = $false
    if ($request.action -eq 'status') {
        $testDoc = $word.Documents.Add()
        $access = $false
        try { $access = $null -ne $testDoc.VBProject.VBComponents } catch {}
        $testDoc.Close([ref][int]0)
        Save-WordResult @{ installed=$true; version=[string]$word.Version; vbaAccess=$access }
    } else {
        Emit-WordEvent @{type='progress';message='Opening a protected copy of the Word file'}
        $document = $word.Documents.Open([string]$request.inputPath, $false, $false, $false)
        Emit-WordEvent @{type='progress';message='Word document opened'}
        if ($document.ProtectionType -ne -1) { throw 'Document is protected. Remove protection from a copy first.' }
        if ($request.action -eq 'inspect') {
            $document.Repaginate()
            for ($s = 1; $s -lt $document.Sections.Count; $s++) { $sectionEnds += [int]$document.Sections.Item($s).Range.End - 1 }
            foreach ($shape in $document.Shapes) { $floatingAnchors += [int]$shape.Anchor.Start }
            $items = New-Object Collections.Generic.List[object]
            $characters = 0
            $paragraphCount = [int]$document.Paragraphs.Count
            $limit = [Math]::Min($paragraphCount, 1000)
            for ($index = 1; $index -le $limit; $index++) {
                if (Test-Path -LiteralPath ($request.progressPath + '.cancel')) { throw 'Task cancelled.' }
                $info = Paragraph-Info $document.Paragraphs.Item($index) $index
                if ($characters + $info.text.Length -gt 60000) { break }
                $items.Add($info); $characters += $info.text.Length
            }
            $tocs = @()
            foreach ($toc in $document.TablesOfContents) {
                $entries = @($items.ToArray() | Where-Object { $_.end -gt $toc.Range.Start -and $_.start -lt $toc.Range.End })
                if ($entries.Count) { $tocs += @{start=[int]$toc.Range.Start;end=[int]$toc.Range.End;first=$entries[0].index;last=$entries[-1].index} }
            }
            $standardCover = $null
            if ($document.Bookmarks.Exists('SpecFlowStandardCover')) { $standardCover = @{start=0;end=[int]$document.Sections.Item(1).Range.End} }
            Save-WordResult @{ paragraphs=$items.ToArray(); nativeTocs=$tocs; standardCover=$standardCover; paragraphCount=$paragraphCount; truncated=($items.Count -lt $paragraphCount); tables=[int]$document.Tables.Count; pictures=([int]$document.InlineShapes.Count + [int]$document.Shapes.Count) }
        } elseif ($request.action -eq 'format') {
            # Mark the immutable upload before SaveAs or tracked edits shift it.
            Mark-LayoutRange $request.frontMatter.cover 'SfOldCover'
            Mark-LayoutRange $request.frontMatter.toc 'SfOldToc'
            if ($request.frontMatter.bodyFirst) {
                $body = $document.Paragraphs.Item([int]$request.frontMatter.bodyFirst).Range.Duplicate
                $body.Collapse(1)
                $null = $document.Bookmarks.Add('SfBodyStart', $body)
            }
            # Save and reopen a macro-free intermediate before loading ONLY the bundled formatter.
            $macroFreePath = Join-Path $request.workDirectory 'working.docx'
            Emit-WordEvent @{type='progress';message='Saving the macro-free working copy'}
            $docxFormat = 12
            $document.SaveAs2([ref][string]$macroFreePath, [ref][int]$docxFormat)
            Emit-WordEvent @{type='progress';message='Created the macro-free working copy'}
            $document.Close([ref][int]0); $document = $null
            $word.AutomationSecurity = 1 # Scoped to this private instance and this macro-free copy.
            $document = $word.Documents.Open([string]$macroFreePath, $false, $false, $false)
            if ($null -eq $document) { throw 'Word did not reopen the working copy.' }
            Emit-WordEvent @{type='progress';message='Loading the trusted VBA module'}
            try { $project = $document.VBProject; if ($null -eq $project) { throw 'VBProject is unavailable' }; $components = $project.VBComponents; if ($null -eq $components) { throw 'VBComponents is unavailable' } } catch { throw ('VBA_ACCESS_DISABLED: ' + $_.Exception.Message + '. In Word Trust Center enable Trust access to the VBA project object model. SpecFlow does not change this setting.') }
            if ($document.Revisions.Count -gt 0) { throw 'The document contains unresolved tracked changes. Accept or reject them in a separate copy first.' }
            foreach ($change in @($request.changes | Sort-Object index -Descending)) {
                $paragraph = $document.Paragraphs.Item([int]$change.index)
                $info = Paragraph-Info $paragraph ([int]$change.index)
                if ($info.text -cne [string]$change.originalText) { throw 'Paragraph text changed since review. Analyze the file again.' }
                if ($change.role -match '^heading[1-4]$') { $paragraph.OutlineLevel = [int]$change.role.Substring(7) }
                elseif ($change.role -eq 'body') { $paragraph.OutlineLevel = 10 }
                if ($change.replacement -and $change.replacement -cne $info.text) {
                    if (-not $info.editable -or $info.inTable) { throw 'Content edit would overwrite a field, equation, picture, table or tracked change.' }
                    $document.TrackRevisions = $true
                    $range = $paragraph.Range.Duplicate
                    $range.End = $range.End - 1
                    $range.Text = [string]$change.replacement
                    $document.TrackRevisions = $false
                }
            }
            $module = $components.Add(1)
            $module.Name = 'SpecFlowFormatter'
            $module.CodeModule.AddFromString([IO.File]::ReadAllText($request.formatterPath, [Text.Encoding]::ASCII))
            $carrier = Join-Path $request.workDirectory 'formatter-working.docm'
            $docmFormat = 13
            $document.SaveAs2([ref][string]$carrier, [ref][int]$docmFormat)
            $document.Activate()
            Emit-WordEvent @{type='progress';message='Running the bundled V35.1 VBA formatter'}
            $report = [string]$word.Run('SpecFlowFormatter.SpecFlow_Run', [ref][string]$request.progressPath)
            Emit-WordEvent @{type='progress';message='Standardizing cover, updateable contents and image cells'}
            $layoutModule = $components.Add(1)
            $layoutModule.Name = 'SpecFlowLayout'
            $layoutModule.CodeModule.AddFromString([IO.File]::ReadAllText([string]$request.layoutModulePath, [Text.Encoding]::ASCII))
            foreach ($key in @('mode','preset','project','title','company','author','reviewer','approver','date','number')) {
                $value = [string]$request.layout.cover.$key
                if (-not $value) { $value = ' ' }
                $null = $document.Variables.Add('SfCover_' + $key, $value)
            }
            $null = $document.Variables.Add('SfTocMode', [string]$request.layout.toc.mode)
            $null = $document.Variables.Add('SfTocLevels', [string]$request.layout.toc.levels)
            $null = $document.Variables.Add('SfImageCells', [string][bool]$request.layout.imageCells)
            $null = $document.Variables.Add('SfLayoutProgress', [string]$request.progressPath)
            $document.Activate()
            $layoutReport = [string]$word.Run('SpecFlowLayout.SpecFlow_Layout')
            if ($layoutReport.StartsWith('ERROR|')) { throw ('Standard cover / contents / images failed: ' + $layoutReport) }
            Emit-WordEvent @{type='progress';message='Saving the standardized cover, contents and image cells'}
            $outputPath = [string]$request.outputPath
            $document.SaveAs2([ref][string]$outputPath, [ref][int]$docxFormat) # Deliver a macro-free DOCX, never the working DOCM.
            Save-WordResult @{ outputPath=$request.outputPath; report=$report; layoutReport=$layoutReport; paragraphs=[int]$document.Paragraphs.Count; tables=[int]$document.Tables.Count; pictures=[int]$document.InlineShapes.Count; tocCount=[int]$document.TablesOfContents.Count; revisions=[int]$document.Revisions.Count; macroFree=$true }
        } else { throw 'Unsupported Word worker action' }
    }
} catch {
    Emit-WordEvent @{type='error';message=($_.Exception.Message + ' (worker line ' + $_.InvocationInfo.ScriptLineNumber + ')')}
    exit 1
} finally {
    if ($document) { try { $document.Close([ref][int]0) } catch {} }
    if ($word) {
        if ($null -ne $previousUpdateLinks) { try { $word.Options.UpdateLinksAtOpen = $previousUpdateLinks } catch {} }
        try { $word.NormalTemplate.Saved = $true; $word.Quit([ref][int]0) } catch {}
        [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($word)
    }
    [GC]::Collect(); [GC]::WaitForPendingFinalizers()
}

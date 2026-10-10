Option Explicit

' Fixed, trusted post-processing module. No user/model supplied VBA is executed.
' Input is plain document variables and reviewed bookmarks. Output stays DOCX.
Private SfLog As String

Private Function SfValue(ByVal key As String) As String
    SfValue = Trim$(ActiveDocument.Variables(key).Value)
End Function

Private Function SfZh(ByVal hexCodes As String) As String
    Dim codes As Variant, code As Variant
    codes = Split(hexCodes, " ")
    For Each code In codes
        SfZh = SfZh & ChrW$(CLng("&H" & code))
    Next code
End Function

Private Sub SfStage(ByVal message As String)
    Dim fileNumber As Integer, progressPath As String
    progressPath = SfValue("SfLayoutProgress")
    If Len(Dir$(progressPath & ".cancel")) > 0 Then Err.Raise vbObjectError + 2811, "SpecFlow", "Layout cancelled."
    fileNumber = FreeFile
    Open progressPath For Append As #fileNumber
    Print #fileNumber, message
    Close #fileNumber
End Sub

Public Function SpecFlow_Layout() As String
    Dim doc As Document, previousTracking As Boolean, coverEnd As Long, insertAt As Long
    Dim toc As TableOfContents, tocRange As Range, bodyRange As Range, level As Long
    Dim tocMode As String, coverMode As String, key As Variant, i As Long
    Dim errorNumber As Long, errorMessage As String
    Set doc = ActiveDocument
    previousTracking = doc.TrackRevisions
    On Error GoTo Failed
    doc.TrackRevisions = False
    SfLog = ""
    coverMode = SfValue("SfCover_mode")
    tocMode = SfValue("SfTocMode")
    If tocMode = "rebuild" Then
        SfStage "Rebuilding the updateable Word table of contents"
        If doc.Bookmarks.Exists("SfOldToc") Then
            insertAt = doc.Bookmarks("SfOldToc").Range.Start
            doc.Bookmarks.Add "SfTocInsert", doc.Range(insertAt, insertAt)
            doc.Bookmarks("SfOldToc").Range.Delete
            SfLog = SfLog & "Previous contents replaced after review." & vbCrLf
        ElseIf doc.Bookmarks.Exists("SfOldCover") Then
            insertAt = doc.Bookmarks("SfOldCover").Range.End
            doc.Bookmarks.Add "SfTocInsert", doc.Range(insertAt, insertAt)
        Else
            doc.Bookmarks.Add "SfTocInsert", doc.Range(0, 0)
        End If
    End If
    If coverMode = "standard" Then
        SfStage "Inserting the standard engineering cover"
        If doc.Bookmarks.Exists("SfOldCover") Then
            doc.Bookmarks("SfOldCover").Range.Delete
            SfLog = SfLog & "Recognized cover replaced after review." & vbCrLf
        Else
            SfLog = SfLog & "Standard cover inserted; unrecognized original front matter preserved." & vbCrLf
        End If
        coverEnd = SfCover(doc)
    End If
    If tocMode = "rebuild" Then
        insertAt = doc.Bookmarks("SfTocInsert").Range.Start
        If insertAt < coverEnd Then insertAt = coverEnd
        Set tocRange = doc.Range(insertAt, insertAt)
        tocRange.InsertBefore SfZh("76EE 5F55") & vbCr & vbCr
        ' Both inserted paragraphs must be body text. Otherwise the spare
        ' paragraph inherits Heading 1 and appears as an empty numbered TOC item.
        Set tocRange = doc.Range(insertAt, insertAt + 4)
        tocRange.Style = wdStyleNormal
        tocRange.ListFormat.RemoveNumbers
        tocRange.ParagraphFormat.OutlineLevel = wdOutlineLevelBodyText
        Set bodyRange = doc.Range(insertAt + 4, insertAt + 4)
        doc.Bookmarks.Add "SfAfterToc", bodyRange
        Set tocRange = doc.Range(insertAt, insertAt + 3)
        tocRange.Style = wdStyleNormal
        tocRange.ListFormat.RemoveNumbers
        With tocRange
            .Font.NameFarEast = SfZh("9ED1 4F53")
            .Font.Size = 18
            .Font.Color = wdColorBlack
            .ParagraphFormat.OutlineLevel = wdOutlineLevelBodyText
            .ParagraphFormat.Alignment = wdAlignParagraphCenter
            .ParagraphFormat.FirstLineIndent = 0
            .ParagraphFormat.SpaceAfter = 18
            .ParagraphFormat.PageBreakBefore = False
        End With
        level = CLng(SfValue("SfTocLevels"))
        SfStage "Building the native linked TOC field"
        Set tocRange = doc.Range(insertAt + 3, insertAt + 3)
        Set toc = doc.TablesOfContents.Add(Range:=tocRange, UseHeadingStyles:=False, _
            UpperHeadingLevel:=1, LowerHeadingLevel:=level, UseFields:=False, _
            RightAlignPageNumbers:=True, IncludePageNumbers:=True, _
            AddedStyles:=SfZh("6837 5F0F") & "1", _
            UseHyperlinks:=True, HidePageNumbersInWeb:=False, UseOutlineLevels:=False)
        ' V35 publishes custom heading styles rather than built-in Heading 1-4.
        For i = 1 To level
            toc.HeadingStyles.Add Style:=SfZh("6837 5F0F") & CStr(i), Level:=i
            With doc.Styles(wdStyleTOC1 - (i - 1))
                .Font.NameFarEast = SfZh("5B8B 4F53")
                .Font.Name = "Times New Roman"
                .Font.Size = 12
                .Font.Color = wdColorBlack
                .ParagraphFormat.LineSpacingRule = wdLineSpaceSingle
                .ParagraphFormat.SpaceAfter = 6
            End With
        Next i
        toc.TabLeader = wdTabLeaderDots
        toc.Update
        Set bodyRange = doc.Bookmarks("SfAfterToc").Range
        bodyRange.Paragraphs(1).PageBreakBefore = True
        SfLog = SfLog & "Native TOC field created with hyperlinks; update in Word with F9 / Update Table." & vbCrLf
    End If
    If LCase$(SfValue("SfImageCells")) = "true" Then
        SfStage "Placing images in single-spaced table cells"
        SfImages doc, coverEnd
    End If
    doc.Repaginate
    If tocMode = "rebuild" Then
        toc.Update
        doc.Repaginate
        toc.UpdatePageNumbers
    End If
    For Each key In Array("SfOldCover", "SfOldToc", "SfBodyStart", "SfTocInsert", "SfAfterToc")
        If doc.Bookmarks.Exists(CStr(key)) Then doc.Bookmarks(CStr(key)).Delete
    Next key
    For Each key In Array("SfCover_mode", "SfCover_preset", "SfCover_project", "SfCover_title", "SfCover_company", "SfCover_author", "SfCover_reviewer", "SfCover_approver", "SfCover_date", "SfCover_number", "SfTocMode", "SfTocLevels", "SfImageCells", "SfLayoutProgress")
        doc.Variables(CStr(key)).Delete
    Next key
    doc.TrackRevisions = previousTracking
    SpecFlow_Layout = SfLog
    Exit Function
Failed:
    errorNumber = Err.Number
    errorMessage = Err.Description
    On Error Resume Next
    doc.TrackRevisions = previousTracking
    ' Return errors to the worker; never show a hidden VBA debug dialog.
    SpecFlow_Layout = "ERROR|" & CStr(errorNumber) & "|" & errorMessage
End Function

Private Function SfCover(ByVal doc As Document) As Long
    Dim lines As String, rng As Range, para As Paragraph, i As Long, coverSection As Section
    Dim label As String, key As Variant, coverParas As Long, newBody As Section
    lines = SfValue("SfCover_project") & vbCr & SfValue("SfCover_title") & vbCr & vbCr
    If Len(SfValue("SfCover_number")) > 0 Then lines = lines & SfZh("6587 6863 7F16 53F7") & ": " & SfValue("SfCover_number") & vbCr
    For Each key In Array("author", "reviewer", "approver")
        If Len(SfValue("SfCover_" & CStr(key))) > 0 Then
            Select Case CStr(key)
                Case "author": label = SfZh("7F16 5236")
                Case "reviewer": label = SfZh("5BA1 6838")
                Case "approver": label = SfZh("6279 51C6")
            End Select
            lines = lines & label & ": " & SfValue("SfCover_" & CStr(key)) & vbCr
        End If
    Next key
    lines = lines & vbCr & SfValue("SfCover_company") & vbCr & SfValue("SfCover_date") & vbCr
    Set rng = doc.Range(0, 0)
    SfStage "Writing standard cover metadata"
    rng.InsertBefore lines
    Set rng = doc.Range(Len(lines), Len(lines))
    rng.InsertBreak wdSectionBreakNextPage
    SfStage "Preserving existing section headers and footers"
    SfCover = doc.Sections(1).Range.End
    Set coverSection = doc.Sections(1)
    ' Preserve original header/footer stories, including section-specific fields
    ' and logos. They must never be deleted through a linked cover story.
    coverSection.PageSetup.VerticalAlignment = wdAlignVerticalCenter
    SfStage "Applying standard cover typography"
    With coverSection.Range
        .Style = wdStyleNormal
        .ListFormat.RemoveNumbers
        .Font.NameFarEast = SfZh("5B8B 4F53")
        .Font.Name = "Times New Roman"
        .Font.Size = 14
        .Font.Color = wdColorBlack
        With .ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphCenter
            .FirstLineIndent = 0
            .LeftIndent = 0
            .RightIndent = 0
            .LineSpacingRule = wdLineSpaceSingle
            .SpaceBefore = 0
            .SpaceAfter = 16
            .PageBreakBefore = False
            .KeepWithNext = False
        End With
    End With
    For i = 1 To 2
        Set para = coverSection.Range.Paragraphs(i)
        para.Range.Style = wdStyleTitle
        para.Range.Font.NameFarEast = SfZh("9ED1 4F53")
        para.Range.Font.Color = wdColorBlack
        para.Range.Font.Size = 22
        If i = 2 Then para.Range.Font.Size = 26
        para.Range.ParagraphFormat.OutlineLevel = wdOutlineLevelBodyText
        para.Range.ParagraphFormat.SpaceAfter = 26
        para.Range.ParagraphFormat.Alignment = wdAlignParagraphCenter
        para.Range.ParagraphFormat.PageBreakBefore = False
        para.Range.ParagraphFormat.KeepWithNext = False
        para.Range.ParagraphFormat.Borders.Enable = False
    Next i
    If SfValue("SfCover_preset") = "report" Then
        coverSection.Range.Paragraphs(2).Range.Font.Size = 24
        coverSection.Range.Paragraphs(2).SpaceAfter = 40
    End If
    If doc.Sections.Count > 1 Then doc.Sections(2).PageSetup.VerticalAlignment = wdAlignVerticalTop
    doc.Bookmarks.Add "SpecFlowStandardCover", doc.Sections(1).Range
    SfStage "Standard cover complete"
End Function

Private Sub SfImageParagraph(ByVal rng As Range)
    With rng.ParagraphFormat
        .LineSpacingRule = wdLineSpaceSingle
        .DisableLineHeightGrid = True
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
        .SpaceBefore = 0
        .SpaceAfter = 0
        .KeepWithNext = False
        .KeepTogether = True
        .PageBreakBefore = False
    End With
End Sub

Private Function SfInferCoverEnd(ByVal doc As Document) As Long
    Dim para As Paragraph, text As String, metadata As Long, titleFound As Boolean, count As Long
    For Each para In doc.Paragraphs
        count = count + 1
        If count > 60 Then Exit Function
        text = Trim$(Replace(para.Range.Text, vbCr, ""))
        If Len(text) > 180 Or para.OutlineLevel < wdOutlineLevelBodyText Then Exit Function
        If InStr(text, SfZh("8BBE 8BA1")) > 0 Or InStr(text, SfZh("62A5 544A")) > 0 Then titleFound = True
        If InStr(text, SfZh("7F16 5236")) > 0 Or InStr(text, SfZh("5BA1 6838")) > 0 Or InStr(text, SfZh("6279 51C6")) > 0 Or InStr(text, SfZh("65E5 671F")) > 0 Then metadata = metadata + 1
        If InStr(text, Chr$(12)) > 0 Then
            If titleFound And metadata >= 2 Then SfInferCoverEnd = para.Range.End
            Exit Function
        End If
        If para.Range.End < doc.Content.End - 1 Then
            If doc.Range(para.Range.End, para.Range.End).Paragraphs(1).PageBreakBefore Then
                If titleFound And metadata >= 2 Then SfInferCoverEnd = para.Range.End
                Exit Function
            End If
        End If
    Next para
End Function

Private Sub SfImages(ByVal doc As Document, ByVal coverEnd As Long)
    Dim i As Long, image As InlineShape, shp As Shape, rng As Range, cell As Cell
    Dim table As table, images As Collection, created As Long, reused As Long, skipped As Long
    Dim maximumWidth As Single, maximumHeight As Single, imageScale As Single
    Dim coverLimit As Long, txt As String
    coverLimit = coverEnd
    If doc.Bookmarks.Exists("SfOldCover") Then coverLimit = doc.Bookmarks("SfOldCover").Range.End
    If coverLimit = 0 Then coverLimit = SfInferCoverEnd(doc)
    For i = doc.Shapes.Count To 1 Step -1
        SfStage "Checking body picture anchors"
        Set shp = doc.Shapes(i)
        If shp.Anchor.StoryType = wdMainTextStory And shp.Anchor.Start >= coverLimit Then
            If shp.Type = msoPicture Or shp.Type = msoLinkedPicture Then
                If shp.Type = msoLinkedPicture Then
                    skipped = skipped + 1 ' Never fetch external linked media.
                Else
                    Set image = shp.ConvertToInlineShape
                End If
            Else
                skipped = skipped + 1 ' Preserve grouped drawings, equations, OLE and controls.
            End If
        End If
    Next i
    Set images = New Collection
    For i = 1 To doc.StoryRanges(wdMainTextStory).InlineShapes.Count
        Set image = doc.StoryRanges(wdMainTextStory).InlineShapes(i)
        If image.Range.Start >= coverLimit Then
            If image.Type = wdInlineShapePicture Then images.Add i
            If image.Type = wdInlineShapeLinkedPicture Then skipped = skipped + 1
        End If
    Next i
    ' Conversion rebuilds InlineShape COM objects. Reacquire by current reverse
    ' index instead of retaining stale object references across conversions.
    For i = images.Count To 1 Step -1
        SfStage "Placing images in single-spaced table cells"
        Set image = doc.StoryRanges(wdMainTextStory).InlineShapes(CLng(images(i)))
        Set rng = image.Range.Duplicate
        If rng.Revisions.Count > 0 Then
            skipped = skipped + 1
        Else
            maximumWidth = rng.Sections(1).PageSetup.PageWidth - rng.Sections(1).PageSetup.LeftMargin - rng.Sections(1).PageSetup.RightMargin - 12
            maximumHeight = rng.Sections(1).PageSetup.PageHeight - rng.Sections(1).PageSetup.TopMargin - rng.Sections(1).PageSetup.BottomMargin - 70
            If rng.Information(wdWithInTable) Then
                Set cell = rng.Cells(1)
                maximumWidth = cell.Width - 12
                SfImageParagraph image.Range
                reused = reused + 1
            Else
                ' Convert ONLY the picture character, not adjacent text/captions.
                Set table = rng.ConvertToTable(Separator:=wdSeparateByParagraphs, NumRows:=1, NumColumns:=1, AutoFitBehavior:=wdAutoFitFixed)
                Set image = table.Cell(1, 1).Range.InlineShapes(1)
                table.Title = "SpecFlow image cell"
                table.AllowAutoFit = False
                table.PreferredWidthType = wdPreferredWidthPoints
                table.PreferredWidth = maximumWidth + 12
                table.Rows.Alignment = wdAlignRowCenter
                table.Rows.HeightRule = wdRowHeightAuto
                table.Rows.AllowBreakAcrossPages = False
                table.Borders.Enable = False
                table.TopPadding = 3
                table.BottomPadding = 3
                table.LeftPadding = 6
                table.RightPadding = 6
                table.Range.Cells.VerticalAlignment = wdCellAlignVerticalCenter
                SfImageParagraph table.Range
                table.Range.ListFormat.RemoveNumbers
                created = created + 1
                ' Keep an existing caption immediately after its image table.
                Set rng = doc.Range(table.Range.End, table.Range.End)
                txt = Trim$(Replace(rng.Paragraphs(1).Range.Text, vbCr, ""))
                If Left$(txt, 1) = SfZh("56FE") Then table.Range.ParagraphFormat.KeepWithNext = True
            End If
            imageScale = 1
            If image.Width > maximumWidth Then imageScale = maximumWidth / image.Width
            If image.Height * imageScale > maximumHeight Then imageScale = maximumHeight / image.Height
            If imageScale < 1 Then
                image.LockAspectRatio = msoTrue
                image.Width = image.Width * imageScale
            End If
        End If
    Next i
    SfLog = SfLog & "Image cells created: " & CStr(created) & "; existing cells retained: " & CStr(reused) & "; unsupported/linked objects preserved: " & CStr(skipped) & "." & vbCrLf
End Sub

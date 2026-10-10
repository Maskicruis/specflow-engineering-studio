Attribute VB_Name = "ChineseDocumentFormatterOneClickV35"
Option Explicit

' V35 TABLE INDENT FIX: tables use Normal, not Body; zero indent is verified.


' V35 FINAL NON-BOLD RULES:
' Header text: Bold=False, including header shapes/text boxes.
' Table content: Bold=False at whole-table and paragraph level.
' V33 OutlineLevel-only headings and Body Lock are unchanged.


' V35 HEADING AUTHORITY:
' Original OutlineLevel 1 -> Style 1
' Original OutlineLevel 2 -> Style 2
' Original OutlineLevel 3 -> Style 3
' Original OutlineLevel 4 -> Style 4
' Original Body Text       -> Body
' Visible numbering NEVER promotes Body text to a heading.
' Temporary body bookmarks provide a final anti-promotion guard.


' V35.1 PUBLIC ENTRY POINTS:
'   OneClick_FormatDocument_V35 formats the complete document.
'   InsertCaption safely wraps Word's built-in Insert Caption command.
'   RepairCaptionChapterFields_V35 repairs captions inserted by other code.
' All other maintenance/test procedures remain intentionally hidden.


' ============================================================
' ONE-CLICK Chinese document formatter V35 STRICT OUTLINE SNAPSHOT + BODY LOCK TABLE TEXT LEADING-WHITESPACE FIX.
'
' SAFE PROCESSING ORDER:
' 1. Save the original and attempt a timestamped backup.
' 2. Identify every paragraph before changing any style.
' 3. Configure page setup and the eight required styles.
' 4. Remove old heading numbering and typed heading prefixes.
' 5. Apply the required paragraph and caption styles.
' 6. Build one fresh multilevel-list template.
' 7. Apply heading numbering in document order.
' 8. Hide unused styles instead of deleting them.
' 9. Continue formatting if the optional backup cannot be created.
' 10. Scan paragraphs once and cache style decisions for long documents.
' 11. Create an unnamed list template and tolerate optional list settings.
' 12. Never delete styles; restore the Styles pane and publish required Quick Styles.
' 13. Format tables to window width, centered 12-point text and exact 20-point spacing.
' 14. Center pictures and use single line spacing for picture paragraphs.
' 15. Never clear all QuickStyle flags; preserve the existing Ribbon gallery.
' 16. Verify required styles after saving and report compatibility/save-format state.
' 17. Move the cursor to text so an object selection cannot display No Style.
' 18. Create all required styles even when none exist initially.
' 19. Use Visibility=False and show user-defined style names.
' 20. Clear table indentation through Range, Selection and paragraph verification.
' 21. Add table-only repair and table-text selection macros.
' 22. Remove Selection switching from batch table processing.
' 23. Apply table format once by Range and reinforce indent by Cell.Range.
' 24. Detect and reapply level-4 heading style by style, outline, list level and typed prefix.
' 25. Create separate Figure Caption and Table Caption styles with fast static numbering.
' 26. Use landscape-section header/footer distances of 2.0 cm and 1.4 cm.
' 27. Eliminate caption STYLEREF/SEQ fields and field updates.
' 28. Apply Style 4 during the existing heading scan.
' 29. Disable background pagination while processing.
' 30. Build one structural index and skip table paragraphs in the body pass.
' 31. Format adjacent body paragraphs as ranges instead of one by one.
' 32. Number headings and index captions in the same forward scan.
' 33. Use a sequential TOC pointer instead of searching every TOC per paragraph.
' 34. Use FileCopy backup and save the formatted document only once.
' 35. Report stage timings for performance diagnostics.
' 36. Do not add, remove or recalculate figure/table caption text.
' 37. Remove only inherited automatic list numbering from captions.
' 38. Use non-bold caption styles with corrected half-line spacing.
' 39. Force zero indentation for every table cell and picture paragraph.
' 40. Build long completion messages without excessive line continuations.
' 41. Remove the Excel-only event-toggle code from Word VBA.
' 42. Replace the full paragraph index with a streaming-safe engine.
' 43. Store positions only for headings, not for every paragraph.
' 44. Format picture paragraphs as single-spaced with zero indentation.
' 45. Format captions only; never create or recalculate caption numbers.
' 46. Remove typed list prefixes before figure/table labels.
' 47. Make figure/table caption formatting identical except spacing.
' 48. Combine body formatting and special-paragraph detection in one scan.
' 49. Group adjacent body paragraphs into large Range operations.
' 50. Detect captions before headings and correct old Style 1 captions.
' 51. Number only paragraphs whose final style is exactly Style 1-4.
' 52. Never infer a heading from caption outline/list properties.
' 53. Never modify the document while the main paragraph scan is running.
' 54. Store body ranges, then format them after the scan completes.
' 55. Remove ListFormat calls from ordinary paragraph classification.
' 56. Use manual numeric-prefix parsing instead of regex for headings.
' 57. Link heading styles to one list template; no per-heading numbering loop.
' 58. Temporarily use Draft/Normal view to reduce repagination.
' 59. Verified backup is mandatory; formatting aborts if backup fails.
' 60. Backup occurs before TrackRevisions/page/style changes.
' 61. V35 active heading detection uses original OutlineLevel only.
' 62. Existing Style 1-4 text must still look like a real heading.
' 63. Typed heading numbers require whitespace after the prefix.
' 64. Use sequential table/TOC boundaries during the scan.
' 65. RepairCurrentDocument_V35 uses the same full safe pipeline.
' 66. Never use VBA FileCopy on the open active document.
' 67. Backup method 1 uses Binary Access Read Shared in 1 MB chunks.
' 68. Fallback backup methods are FSO.CopyFile and Word SaveCopyAs.
' 69. TestBackupOnly_V35 verifies backup without changing formatting.
' 70. Scan before style deletion so original style clues are preserved.
' 71. Delete old custom paragraph/linked/list styles, then recreate required styles.
' 72. Preserve custom character/table styles to protect inline and table design.
' 73. Restrict Quick Styles gallery to Body, Style1-4, Caption, Figure Caption, Table Caption.
' 74. Remove any old typed heading prefix before applying a heading style.
' 75. All heading levels 1-4 are automatically numbered.
' 76. Every heading number is followed by exactly two ordinary spaces.
' 77. Remove old typed heading numbers repeatedly before applying the new style.
' 78. Format all existing headers as FangSong_GB2312/TNR, 10.5 pt, no first-line indent.
' 79. Preserve custom styles actively used outside the main story.
' 80. Recognize legacy numeric chapter style names before style cleanup.
' 81. V35 heading styles are assigned ONLY from original paragraph OutlineLevel.
' 82. Numeric prefixes never promote body text to a heading.
' 83. Existing style names never promote body text to a heading.
' 84. Captions are classified before OutlineLevel headings.
' 85. Old heading numbers are stripped only after OutlineLevel confirms a heading.
' 86. All sections now use HeaderDistance 2.4 cm and FooterDistance 2.2 cm.
' 87. Removed the old landscape 2.0/1.4 cm exception.
' 88. Header paragraph left/right/first-line indents are all forced to zero.
' 89. Header character-unit indents are also forced to zero.
' 90. Header text boxes/shapes are formatted as well.
' 91. RepairHeadersOnly_V35 repairs headers without rerunning the full document workflow.
' 92. V35 reinforces zero indentation in EVERY table cell.
' 93. Mixed/non-zero cells receive paragraph-by-paragraph fallback correction.
' 94. V35.1 repairs native caption STYLEREF fields so chapter numbering
'     follows the formatter's custom Style 1-4 paragraph styles.
' 95. V35.1 intercepts Word's built-in Insert Caption command and repairs
'     the new Figure/Table chapter field immediately after insertion.
' 94. Table Body style is followed by direct zero-indent formatting.
' 95. RepairTablesOnly_V35 performs a backup-protected table-only repair.
' 96. Every table paragraph is now normalized directly, not conditionally.
' 97. Leading spaces/tabs/NBSP/full-width U+3000 spaces are removed from table paragraphs.
' 98. This fixes apparent first-line indent that is actually stored as text characters.
'
' The code contains no Chinese identifiers or Chinese string
' literals. Required Chinese names are generated with ChrW.
' ============================================================

Private Const EN_FONT As String = "Times New Roman"

' Structural index values.
Private Const PARA_KIND_TOC As Integer = -1
Private Const PARA_KIND_TABLE As Integer = -2

' Number of records allocated when a dynamic index grows.
Private Const INDEX_GROW_BY As Long = 2048

' True: delete manually typed prefixes such as:
' 1 Title / 1.1 Title / 1.1.1 Title / 1.1.1.1 Title
Private Const REMOVE_TYPED_HEADING_NUMBERS As Boolean = True

' True: reset direct paragraph spacing, indentation and line spacing.
Private Const RESET_DIRECT_PARAGRAPH_FORMATTING As Boolean = True

' True: enforce font family and font size while retaining bold,
' italic, underline, superscript, subscript and text color.
Private Const ENFORCE_FONT_NAME_AND_SIZE As Boolean = True

' True: leave paragraphs inside an existing table of contents unchanged.
Private Const PRESERVE_TABLES_OF_CONTENTS As Boolean = True

' Main one-click macro.

Private Sub TestBackupOnly_V35()

    Dim doc As Document
    Dim backupFile As String
    Dim backupCreated As Boolean

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If doc.ReadOnly Then
        MsgBox "The active document is read-only.", vbExclamation
        Exit Sub
    End If

    If Len(doc.Path) = 0 Then
        MsgBox "Save the document once before testing backup.", _
               vbExclamation
        Exit Sub
    End If

    On Error GoTo BackupError

    Application.StatusBar = "Saving original before backup test..."

    If doc.Saved = False Then doc.Save

    Application.StatusBar = "Creating and verifying backup only..."

    backupCreated = CreateVerifiedBackupV35(doc, backupFile)

    Application.StatusBar = False

    If backupCreated Then
        MsgBox _
            "Backup test succeeded." & vbCrLf & vbCrLf & _
            "Backup file:" & vbCrLf & backupFile & vbCrLf & vbCrLf & _
            "No document formatting was performed.", _
            vbInformation, _
            "Backup Test V35"
    Else
        MsgBox _
            "Backup test failed." & vbCrLf & _
            "No document formatting was performed.", _
            vbCritical, _
            "Backup Test V35"
    End If

    Exit Sub

BackupError:
    Application.StatusBar = False

    MsgBox _
        "Backup test stopped." & vbCrLf & _
        "Error number: " & Err.Number & vbCrLf & _
        "Description: " & Err.Description & vbCrLf & vbCrLf & _
        "No document formatting was performed.", _
        vbCritical, _
        "Backup Test V35"

End Sub


Private Sub RepairHeadersOnly_V35()

    Dim doc As Document
    Dim backupFile As String
    Dim backupCreated As Boolean
    Dim formattedCount As Long
    Dim errorCount As Long
    Dim oldScreenUpdating As Boolean
    Dim currentStep As String
    Dim savedErrNumber As Long
    Dim savedErrDescription As String

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If doc.ReadOnly Then
        MsgBox "The active document is read-only.", vbExclamation
        Exit Sub
    End If

    If doc.ProtectionType <> wdNoProtection Then
        MsgBox "The active document is protected. Remove protection first.", _
               vbExclamation
        Exit Sub
    End If

    If Len(doc.Path) = 0 Then
        MsgBox "Save the document once before repairing headers.", _
               vbExclamation
        Exit Sub
    End If

    ' -------------------------------------------------------------
    ' Mandatory safety backup before ANY header/page-setting change.
    ' -------------------------------------------------------------
    On Error GoTo BackupError

    currentStep = "Saving original before header repair"
    Application.StatusBar = currentStep & "..."

    If doc.Saved = False Then doc.Save

    currentStep = "Creating verified backup before header repair"
    Application.StatusBar = currentStep & "..."

    backupCreated = CreateVerifiedBackupV35(doc, backupFile)

    If Not backupCreated Then
        Application.StatusBar = False

        MsgBox _
            "Header repair did NOT start because a verified backup " & _
            "could not be created.", _
            vbCritical, _
            "Backup Required"

        Exit Sub
    End If

    On Error GoTo RepairError

    oldScreenUpdating = Application.ScreenUpdating
    Application.ScreenUpdating = False

    currentStep = "Setting header/footer distances"
    Application.StatusBar = currentStep & "..."

    ApplyHeaderFooterDistancesOnlyV35 doc

    currentStep = "Formatting header content"
    Application.StatusBar = currentStep & ": starting..."

    FormatAllHeadersV35 _
        doc, formattedCount, errorCount, currentStep

    currentStep = "Saving repaired document"
    Application.StatusBar = currentStep & "..."

    doc.Save

    Application.ScreenUpdating = oldScreenUpdating
    Application.StatusBar = False

    MsgBox _
        "Header repair finished." & vbCrLf & vbCrLf & _
        "Verified backup:" & vbCrLf & backupFile & vbCrLf & vbCrLf & _
        "Header distance from top: 2.4 cm" & vbCrLf & _
        "Footer distance from bottom: 2.2 cm" & vbCrLf & _
        "Header ranges formatted: " & CStr(formattedCount) & vbCrLf & _
        "Header errors: " & CStr(errorCount), _
        vbInformation, _
        "Header Repair V35"

    Exit Sub

BackupError:
    Application.StatusBar = False

    MsgBox _
        "The original document could not be saved/backed up." & vbCrLf & _
        "Header repair has NOT started." & vbCrLf & vbCrLf & _
        "Error number: " & Err.Number & vbCrLf & _
        "Description: " & Err.Description, _
        vbCritical, _
        "Backup Error"

    Exit Sub

RepairError:
    savedErrNumber = Err.Number
    savedErrDescription = Err.Description

    On Error Resume Next
    Application.ScreenUpdating = oldScreenUpdating
    Application.StatusBar = False
    On Error GoTo 0

    MsgBox _
        "Header repair stopped." & vbCrLf & _
        "Step: " & currentStep & vbCrLf & _
        "Error number: " & savedErrNumber & vbCrLf & _
        "Description: " & savedErrDescription & vbCrLf & vbCrLf & _
        "Your verified backup is:" & vbCrLf & backupFile, _
        vbCritical, _
        "Header Repair Error"

End Sub


Private Sub RepairTablesOnly_V35()

    Dim doc As Document
    Dim styBody As Style
    Dim backupFile As String
    Dim backupCreated As Boolean

    Dim tableCount As Long
    Dim tableErrorCount As Long
    Dim normalizedTableParagraphCount As Long

    Dim oldScreenUpdating As Boolean
    Dim currentStep As String
    Dim savedErrNumber As Long
    Dim savedErrDescription As String

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If doc.ReadOnly Then
        MsgBox "The active document is read-only.", vbExclamation
        Exit Sub
    End If

    If doc.ProtectionType <> wdNoProtection Then
        MsgBox "The active document is protected. Remove protection first.", _
               vbExclamation
        Exit Sub
    End If

    If Len(doc.Path) = 0 Then
        MsgBox "Save the document once before repairing tables.", _
               vbExclamation
        Exit Sub
    End If

    ' Mandatory backup before changing table formatting.
    On Error GoTo BackupError

    currentStep = "Saving original before table repair"
    Application.StatusBar = currentStep & "..."

    If doc.Saved = False Then doc.Save

    currentStep = "Creating verified backup before table repair"
    Application.StatusBar = currentStep & "..."

    backupCreated = CreateVerifiedBackupV35(doc, backupFile)

    If Not backupCreated Then
        Application.StatusBar = False

        MsgBox _
            "Table repair did NOT start because a verified backup " & _
            "could not be created.", _
            vbCritical, _
            "Backup Required"

        Exit Sub
    End If

    On Error GoTo RepairError

    oldScreenUpdating = Application.ScreenUpdating
    Application.ScreenUpdating = False

    Set styBody = EnsureParagraphStyle(doc, StyleBodyName())
    ConfigureBodyStyle doc, styBody

    currentStep = "Formatting tables and clearing cell indentation"
    Application.StatusBar = currentStep & ": starting..."

    FormatAllTablesFastV35 _
        doc, styBody, tableCount, tableErrorCount, _
        normalizedTableParagraphCount, currentStep

    currentStep = "Saving repaired document"
    Application.StatusBar = currentStep & "..."

    doc.Save

    Application.ScreenUpdating = oldScreenUpdating
    Application.StatusBar = False
    Application.ScreenRefresh

    MsgBox _
        "Table repair finished." & vbCrLf & vbCrLf & _
        "Verified backup:" & vbCrLf & backupFile & vbCrLf & vbCrLf & _
        "Tables formatted: " & CStr(tableCount) & vbCrLf & _
        "Table paragraphs normalized: " & _
        CStr(normalizedTableParagraphCount) & vbCrLf & _
        "Errors: " & CStr(tableErrorCount), _
        vbInformation, _
        "Table Repair V35"

    Exit Sub

BackupError:
    Application.StatusBar = False

    MsgBox _
        "The original document could not be saved/backed up." & vbCrLf & _
        "Table repair has NOT started." & vbCrLf & vbCrLf & _
        "Error number: " & Err.Number & vbCrLf & _
        "Description: " & Err.Description, _
        vbCritical, _
        "Backup Error"

    Exit Sub

RepairError:
    savedErrNumber = Err.Number
    savedErrDescription = Err.Description

    On Error Resume Next
    Application.ScreenUpdating = oldScreenUpdating
    Application.StatusBar = False
    On Error GoTo 0

    MsgBox _
        "Table repair stopped." & vbCrLf & _
        "Step: " & currentStep & vbCrLf & _
        "Error number: " & savedErrNumber & vbCrLf & _
        "Description: " & savedErrDescription & vbCrLf & vbCrLf & _
        "Your verified backup is:" & vbCrLf & backupFile, _
        vbCritical, _
        "Table Repair Error"

End Sub


' ============================================================
' V35 ONE-CLICK ENTRY POINT
'
' Run ONLY:
'   OneClick_FormatDocument_V35
'
' This single macro performs the complete workflow:
'   1. Save original document.
'   2. Create and verify a backup.
'   3. Scan original outline levels without modifying the document.
'   4. Clean old custom paragraph/list styles.
'   5. Recreate required styles.
'   6. Format body text.
'   7. Rebuild automatic heading numbering.
'   8. Apply heading/caption styles.
'   9. Format all tables and remove real + visual first-line indents.
'  10. Format pictures.
'  11. Apply page setup.
'  12. Format headers.
'  13. Publish only the required Quick Styles.
'  14. Save the completed document.
'
' All test/repair/diagnostic procedures are Private in V35 so users do
' not accidentally run the wrong macro from Alt+F8.
' ============================================================

Public Sub OneClick_FormatDocument_V35()

    Dim doc As Document

    Dim styBody As Style
    Dim styH1 As Style
    Dim styH2 As Style
    Dim styH3 As Style
    Dim styH4 As Style
    Dim styCaption As Style
    Dim styFigureCaption As Style
    Dim styTableCaption As Style
    Dim lt As ListTemplate

    Dim bodyRunStarts() As Long
    Dim bodyRunEnds() As Long
    Dim bodyRunParagraphCounts() As Long
    Dim bodyRunCount As Long

    Dim specialStarts() As Long
    Dim specialKinds() As Integer
    Dim specialCount As Long

    Dim bodyGuardNames() As String
    Dim bodyGuardCount As Long
    Dim bodyGuardRepairedCount As Long
    Dim bodyHeadingListRemovedCount As Long

    Dim oldScreenUpdating As Boolean
    Dim oldTrackRevisions As Boolean
    Dim oldCheckSpelling As Boolean
    Dim oldCheckGrammar As Boolean
    Dim oldPagination As Boolean
    Dim oldDisplayAlerts As WdAlertLevel
    Dim oldViewType As WdViewType
    Dim viewTypeSaved As Boolean
    Dim runtimeChanged As Boolean

    Dim currentStep As String
    Dim backupFile As String
    Dim backupCreated As Boolean

    Dim bodyParagraphCount As Long
    Dim headingLocatedCount As Long
    Dim figureLocatedCount As Long
    Dim tableCaptionLocatedCount As Long
    Dim genericCaptionCount As Long

    Dim headingAppliedCount As Long
    Dim headingErrorCount As Long
    Dim level4AppliedCount As Long
    Dim level4ErrorCount As Long
    Dim figureCaptionCount As Long
    Dim tableCaptionCount As Long
    Dim captionErrorCount As Long
    Dim captionChapterFieldsRepaired As Long
    Dim deletedCustomStyleCount As Long
    Dim failedCustomStyleDeleteCount As Long
    Dim hiddenStyleCount As Long

    Dim tableCount As Long
    Dim tableErrorCount As Long
    Dim tableCellFallbackCount As Long
    Dim inlinePictureCount As Long
    Dim floatingPictureCount As Long
    Dim pictureErrorCount As Long
    Dim headerRangeCount As Long
    Dim headerErrorCount As Long

    Dim coreStylesConfirmed As Long
    Dim captionStylesConfirmed As Long
    Dim styleStateReport As String

    Dim totalStart As Double
    Dim stageStart As Double
    Dim timingReport As String
    Dim completionReport As String

    Dim savedErrNumber As Long
    Dim savedErrDescription As String

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If doc.ReadOnly Then
        MsgBox "The active document is read-only.", vbExclamation
        Exit Sub
    End If

    If doc.ProtectionType <> wdNoProtection Then
        MsgBox "The active document is protected. Remove protection first.", _
               vbExclamation
        Exit Sub
    End If

    If Len(doc.Path) = 0 Then
        MsgBox _
            "Save the document to a local or synced folder before running.", _
            vbExclamation
        Exit Sub
    End If

    totalStart = Timer

    ' ================================================================
    ' HARD SAFETY GATE:
    ' No document formatting or document-setting changes before backup.
    ' ================================================================
    On Error GoTo BackupError

    currentStep = "Saving original before backup"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    If doc.Saved = False Then doc.Save

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Creating and verifying backup"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    backupCreated = CreateVerifiedBackupV35(doc, backupFile)

    AddStageTimingV35 timingReport, currentStep, stageStart

    If Not backupCreated Then
        Application.StatusBar = False

        MsgBox _
            "Formatting did NOT start because a verified backup " & _
            "could not be created." & vbCrLf & vbCrLf & _
            "Run TestBackupOnly_V35 first. If all three backup " & _
            "methods fail, save the file to a normal local folder.", _
            vbCritical, _
            "Backup Required"

        Exit Sub
    End If

    ' Only after backup verification do we change runtime/document settings.
    On Error GoTo FatalError

    oldScreenUpdating = Application.ScreenUpdating
    oldTrackRevisions = doc.TrackRevisions
    oldDisplayAlerts = Application.DisplayAlerts

    On Error Resume Next
    oldCheckSpelling = Options.CheckSpellingAsYouType
    oldCheckGrammar = Options.CheckGrammarAsYouType
    oldPagination = Options.Pagination

    If Windows.Count > 0 Then
        oldViewType = ActiveWindow.View.Type
        viewTypeSaved = True
    End If
    On Error GoTo FatalError

    Application.ScreenUpdating = False
    Application.DisplayAlerts = wdAlertsNone
    doc.TrackRevisions = False

    Options.CheckSpellingAsYouType = False
    Options.CheckGrammarAsYouType = False
    Options.Pagination = False

    On Error Resume Next
    If viewTypeSaved Then ActiveWindow.View.Type = wdNormalView
    On Error GoTo FatalError

    runtimeChanged = True

    currentStep = "Scanning original outline levels without changing document"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    specialCount = BuildOutlineStructureMapV35( _
        doc, _
        bodyRunStarts, bodyRunEnds, bodyRunParagraphCounts, _
        bodyRunCount, specialStarts, specialKinds, _
        bodyParagraphCount, headingLocatedCount, _
        figureLocatedCount, tableCaptionLocatedCount, _
        genericCaptionCount, currentStep)

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Locking original Body ranges"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    bodyGuardCount = CreateBodyGuardBookmarksV35( _
        doc, bodyRunStarts, bodyRunEnds, bodyRunCount, _
        bodyGuardNames)

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Removing old custom paragraph/list styles"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    PurgeOldStylesBeforeRebuildV35 _
        doc, deletedCustomStyleCount, _
        failedCustomStyleDeleteCount, hiddenStyleCount

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Creating and configuring styles"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    Set styBody = EnsureParagraphStyle(doc, StyleBodyName())
    Set styH1 = EnsureParagraphStyle(doc, StyleH1Name())
    Set styH2 = EnsureParagraphStyle(doc, StyleH2Name())
    Set styH3 = EnsureParagraphStyle(doc, StyleH3Name())
    Set styH4 = EnsureParagraphStyle(doc, StyleH4Name())
    Set styCaption = EnsureParagraphStyle(doc, StyleCaptionName())
    Set styFigureCaption = EnsureParagraphStyle( _
        doc, StyleFigureCaptionName())
    Set styTableCaption = EnsureParagraphStyle( _
        doc, StyleTableCaptionName())

    ConfigureBodyStyle doc, styBody
    ConfigureHeadingStyle styH1, styBody, wdOutlineLevel1, 18, 28, 1
    ConfigureHeadingStyle styH2, styBody, wdOutlineLevel2, 16, 26, 2
    ConfigureHeadingStyle styH3, styBody, wdOutlineLevel3, 15, 24, 3
    ConfigureHeadingStyle styH4, styBody, wdOutlineLevel4, 15, 24, 4
    ConfigureCaptionStyle styCaption, styBody

    ConfigureFigureCaptionStyleV35 _
        styFigureCaption, styBody, styBody
    ConfigureTableCaptionStyleV35 _
        styTableCaption, styBody, styBody

    AddStageTimingV35 timingReport, currentStep, stageStart

    ' Repair body text before linking heading numbering.
    currentStep = "Formatting body ranges"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    FormatBodyRunsLockedV35 _
        doc, bodyRunStarts, bodyRunEnds, _
        bodyRunParagraphCounts, bodyRunCount, _
        styBody, currentStep

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Creating linked heading numbering"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    Set lt = CreateCompatibleListTemplate(doc, currentStep)
    ConfigureMultilevelListAllLevelsV35 lt, currentStep
    TryLinkStylesToListTemplate lt, styH1, styH2, styH3, styH4

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Applying verified heading and caption styles"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    ProcessSpecialParagraphsOutlineV35 _
        doc, specialStarts, specialKinds, specialCount, _
        styH1, styH2, styH3, styH4, _
        styCaption, styFigureCaption, styTableCaption, _
        headingAppliedCount, headingErrorCount, _
        level4AppliedCount, level4ErrorCount, _
        figureCaptionCount, tableCaptionCount, _
        captionErrorCount, currentStep

    TryLinkStylesToListTemplate lt, styH1, styH2, styH3, styH4

    captionChapterFieldsRepaired = _
        RepairCaptionChapterStyleFieldsV35(doc, False)

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Reasserting original Body ranges"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    ReassertBodyGuardBookmarksV35 _
        doc, bodyGuardNames, bodyGuardCount, _
        styBody, lt, bodyGuardRepairedCount, _
        bodyHeadingListRemovedCount, currentStep

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Formatting tables"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    FormatAllTablesFastV35 _
        doc, styBody, tableCount, tableErrorCount, _
        tableCellFallbackCount, currentStep

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Formatting pictures"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    FormatAllPicturesV35 _
        doc, styBody, inlinePictureCount, floatingPictureCount, _
        pictureErrorCount, currentStep

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Applying page setup"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    ApplyPageSetupToAllSections doc

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Formatting headers"
    Application.StatusBar = currentStep & ": starting..."
    stageStart = Timer

    FormatAllHeadersV35 _
        doc, headerRangeCount, headerErrorCount, currentStep

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Publishing required styles"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    coreStylesConfirmed = PublishAllRequiredStylesFastV35( _
        doc, styBody, styH1, styH2, styH3, styH4, styCaption, _
        styFigureCaption, styTableCaption, _
        captionStylesConfirmed, styleStateReport)

    AddStageTimingV35 timingReport, currentStep, stageStart

    currentStep = "Removing temporary body guards"
    Application.StatusBar = currentStep & "..."

    DeleteBodyGuardBookmarksV35 _
        doc, bodyGuardNames, bodyGuardCount

    currentStep = "Saving formatted document"
    Application.StatusBar = currentStep & "..."
    stageStart = Timer

    doc.Save

    AddStageTimingV35 timingReport, currentStep, stageStart

    RestoreRuntimeSettings _
        doc, oldTrackRevisions, oldScreenUpdating, _
        oldCheckSpelling, oldCheckGrammar

    On Error Resume Next
    Options.Pagination = oldPagination
    Application.DisplayAlerts = oldDisplayAlerts

    If viewTypeSaved Then
        ActiveWindow.View.Type = oldViewType
    End If

    Application.ScreenRefresh
    On Error GoTo 0

    runtimeChanged = False
    Application.StatusBar = False

    AddStageTimingV35 timingReport, "Total", totalStart

    completionReport = "Finished." & vbCrLf & vbCrLf
    completionReport = completionReport & _
        "Verified backup: " & backupFile & vbCrLf
    completionReport = completionReport & _
        "Body paragraphs: " & CStr(bodyParagraphCount) & vbCrLf
    completionReport = completionReport & _
        "Body ranges: " & CStr(bodyRunCount) & vbCrLf
    completionReport = completionReport & _
        "Old custom paragraph/list styles deleted: " & _
        CStr(deletedCustomStyleCount) & vbCrLf
    completionReport = completionReport & _
        "Custom style deletions skipped/failed: " & _
        CStr(failedCustomStyleDeleteCount) & vbCrLf
    completionReport = completionReport & _
        "Other styles removed from Quick Styles: " & _
        CStr(hiddenStyleCount) & vbCrLf
    completionReport = completionReport & _
        "Outline-level headings located: " & CStr(headingLocatedCount) & vbCrLf
    completionReport = completionReport & _
        "Outline-based heading styles applied: " & CStr(headingAppliedCount) & vbCrLf
    completionReport = completionReport & _
        "Original Body ranges guarded: " & _
        CStr(bodyGuardCount) & vbCrLf
    completionReport = completionReport & _
        "Body ranges reasserted after numbering: " & _
        CStr(bodyGuardRepairedCount) & vbCrLf
    completionReport = completionReport & _
        "Accidental heading-list numbering removed from Body: " & _
        CStr(bodyHeadingListRemovedCount) & vbCrLf
    completionReport = completionReport & _
        "Heading errors: " & CStr(headingErrorCount) & vbCrLf
    completionReport = completionReport & _
        "Level-4 styles applied: " & _
        CStr(level4AppliedCount) & vbCrLf
    completionReport = completionReport & _
        "Level-1 numbering: enabled (1.)" & vbCrLf
    completionReport = completionReport & _
        "Figure captions corrected; no numbering added: " & _
        CStr(figureCaptionCount) & vbCrLf
    completionReport = completionReport & _
        "Table captions corrected; no numbering added: " & _
        CStr(tableCaptionCount) & vbCrLf
    completionReport = completionReport & _
        "Caption chapter fields repaired: " & _
        CStr(captionChapterFieldsRepaired) & vbCrLf
    completionReport = completionReport & _
        "Generic captions preserved: " & _
        CStr(genericCaptionCount) & vbCrLf
    completionReport = completionReport & _
        "Tables formatted: " & CStr(tableCount) & vbCrLf
    completionReport = completionReport & _
        "Table paragraphs normalized: " & _
        CStr(tableCellFallbackCount) & vbCrLf
    completionReport = completionReport & _
        "Inline pictures: " & CStr(inlinePictureCount) & vbCrLf
    completionReport = completionReport & _
        "Floating pictures: " & CStr(floatingPictureCount) & vbCrLf
    completionReport = completionReport & _
        "Header ranges formatted: " & _
        CStr(headerRangeCount) & vbCrLf
    completionReport = completionReport & _
        "Header-formatting errors: " & _
        CStr(headerErrorCount) & vbCrLf
    completionReport = completionReport & _
        "Core styles confirmed: " & _
        CStr(coreStylesConfirmed) & " / 6" & vbCrLf
    completionReport = completionReport & _
        "Caption styles confirmed: " & _
        CStr(captionStylesConfirmed) & " / 2" & vbCrLf
    completionReport = completionReport & _
        styleStateReport & vbCrLf & vbCrLf
    completionReport = completionReport & _
        "Stage timings:" & vbCrLf & timingReport

    MsgBox completionReport, vbInformation, _
           "One-Click Document Formatter V35"

    Exit Sub

BackupError:
    Application.StatusBar = False

    MsgBox _
        "The original document could not be saved/backed up." & vbCrLf & _
        "Formatting has NOT started." & vbCrLf & vbCrLf & _
        "Error number: " & Err.Number & vbCrLf & _
        "Description: " & Err.Description, _
        vbCritical, _
        "Backup Error"

    Exit Sub

FatalError:
    savedErrNumber = Err.Number
    savedErrDescription = Err.Description

    If runtimeChanged Then
        RestoreRuntimeSettings _
            doc, oldTrackRevisions, oldScreenUpdating, _
            oldCheckSpelling, oldCheckGrammar

        On Error Resume Next
        Options.Pagination = oldPagination
        Application.DisplayAlerts = oldDisplayAlerts

        If viewTypeSaved Then
            ActiveWindow.View.Type = oldViewType
        End If
        On Error GoTo 0
    End If

    Application.StatusBar = False

    MsgBox _
        "The macro stopped." & vbCrLf & _
        "Step: " & currentStep & vbCrLf & _
        "Error number: " & savedErrNumber & vbCrLf & _
        "Description: " & savedErrDescription & vbCrLf & vbCrLf & _
        "Your verified backup is:" & vbCrLf & backupFile & vbCrLf & vbCrLf & _
        "Completed stage timings:" & vbCrLf & timingReport, _
        vbCritical, _
        "VBA Error"

End Sub


' ============================================================
' V35.1 NATIVE CAPTION COMPATIBILITY
'
' Word's Insert Caption dialog implements chapter numbers with a field such as:
'   STYLEREF 1 \s
' The numeric style reference means the built-in Heading 1 style. V35 uses the
' custom Style 1-4 paragraph styles instead, so the unmodified field displays
' "Error! No text of specified style in document." This compatibility layer
' keeps Word's normal caption dialog and SEQ numbering, but retargets the
' STYLEREF field to the formatter's matching custom heading style.
' ============================================================

' This procedure intentionally has the same name as Word's built-in command.
' When this module is stored in the active document/template (or Normal.dotm),
' References > Insert Caption opens normally and the inserted field is repaired
' immediately after the dialog closes.
Public Sub InsertCaption()

    Dim dialogResult As Long
    Dim repairedCount As Long

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    dialogResult = Dialogs(wdDialogInsertCaption).Show

    If dialogResult <> 0 Then
        repairedCount = _
            RepairCaptionChapterStyleFieldsV35(ActiveDocument, True)

        If repairedCount > 0 Then
            Application.StatusBar = _
                "Caption chapter field repaired for Style 1-4."
        End If
    End If

End Sub


' Run this after captions were inserted by another macro, add-in or automation
' path that bypassed the built-in Insert Caption command wrapper above.
Public Sub RepairCaptionChapterFields_V35()

    Dim repairedCount As Long

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    repairedCount = _
        RepairCaptionChapterStyleFieldsV35(ActiveDocument, True)

    MsgBox _
        "Caption chapter fields repaired: " & CStr(repairedCount), _
        vbInformation, _
        "Caption Repair V35.1"

End Sub


' Silent public entry point for automation and regression tests.
Public Sub RepairCaptionChapterFieldsSilent_V35()

    If Documents.Count = 0 Then Exit Sub

    RepairCaptionChapterStyleFieldsV35 ActiveDocument, True

End Sub


Private Function RepairCaptionChapterStyleFieldsV35( _
                    ByVal doc As Document, _
                    ByVal updateCaptionFields As Boolean) As Long

    Dim mainRange As Range
    Dim fld As Field
    Dim para As Paragraph
    Dim repairedCount As Long

    On Error GoTo SafeExit

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' Iterate the field collection, not every document paragraph. This keeps
    ' caption repair fast in very large documents that contain relatively few
    ' fields. Only numeric STYLEREF 1-4 candidates receive a paragraph check.
    For Each fld In mainRange.Fields

        If IsNumericCaptionStyleRefV35(fld) Then
            Set para = fld.Code.Paragraphs(1)

            If ParagraphHasSequenceFieldV35(para) Then
                If RetargetNumericCaptionStyleRefV35(doc, fld) Then
                    repairedCount = repairedCount + 1

                    If updateCaptionFields Then
                        On Error Resume Next
                        para.Range.Fields.Update
                        On Error GoTo SafeExit
                    End If
                End If
            End If
        End If
    Next fld

SafeExit:
    RepairCaptionChapterStyleFieldsV35 = repairedCount

End Function


Private Function IsNumericCaptionStyleRefV35( _
                    ByVal fld As Field) As Boolean

    Static regexObject As Object

    On Error GoTo SafeExit

    If regexObject Is Nothing Then
        Set regexObject = CreateObject("VBScript.RegExp")
        regexObject.Global = False
        regexObject.IgnoreCase = True
        regexObject.Pattern = _
            "^\s*STYLEREF\s+[1-4]\b"
    End If

    IsNumericCaptionStyleRefV35 = _
        regexObject.Test(fld.Code.Text)

SafeExit:
End Function


Private Function ParagraphHasSequenceFieldV35( _
                    ByVal para As Paragraph) As Boolean

    Dim fld As Field
    Dim codeText As String

    On Error GoTo SafeExit

    For Each fld In para.Range.Fields
        codeText = UCase$(Trim$(fld.Code.Text))

        If Left$(codeText, 4) = "SEQ " Then
            ParagraphHasSequenceFieldV35 = True
            Exit Function
        End If
    Next fld

SafeExit:
End Function


Private Function RetargetNumericCaptionStyleRefV35( _
                    ByVal doc As Document, _
                    ByVal fld As Field) As Boolean

    Static regexObject As Object

    Dim matches As Object
    Dim styleLevel As Integer
    Dim targetStyleName As String
    Dim replacementText As String
    Dim wasLocked As Boolean

    On Error GoTo SafeExit

    If regexObject Is Nothing Then
        Set regexObject = CreateObject("VBScript.RegExp")
        regexObject.Global = False
        regexObject.IgnoreCase = True
        regexObject.Pattern = _
            "^(\s*STYLEREF\s+)([1-4])(\b.*)$"
    End If

    Set matches = regexObject.Execute(fld.Code.Text)
    If matches.Count = 0 Then Exit Function

    styleLevel = CInt(matches(0).SubMatches(1))
    targetStyleName = CaptionHeadingStyleNameV35(styleLevel)

    If Len(targetStyleName) = 0 Then Exit Function
    If Not DocumentHasStyleV35(doc, targetStyleName) Then Exit Function

    replacementText = _
        "$1""" & targetStyleName & """$3"

    wasLocked = fld.Locked
    fld.Locked = False
    fld.Code.Text = regexObject.Replace( _
        fld.Code.Text, replacementText)
    fld.Update
    fld.Locked = wasLocked

    RetargetNumericCaptionStyleRefV35 = True

SafeExit:
    On Error Resume Next
    If wasLocked Then fld.Locked = True
    On Error GoTo 0

End Function


Private Function CaptionHeadingStyleNameV35( _
                    ByVal styleLevel As Integer) As String

    Select Case styleLevel
        Case 1
            CaptionHeadingStyleNameV35 = StyleH1Name()
        Case 2
            CaptionHeadingStyleNameV35 = StyleH2Name()
        Case 3
            CaptionHeadingStyleNameV35 = StyleH3Name()
        Case 4
            CaptionHeadingStyleNameV35 = StyleH4Name()
    End Select

End Function


Private Function DocumentHasStyleV35( _
                    ByVal doc As Document, _
                    ByVal styleName As String) As Boolean

    Dim sty As Style

    On Error Resume Next
    Set sty = doc.Styles(styleName)
    DocumentHasStyleV35 = Not (sty Is Nothing)
    On Error GoTo 0

End Function


Private Function CreateVerifiedBackupV35( _
                    ByVal doc As Document, _
                    ByRef targetFile As String) As Boolean

    Dim sourcePath As String
    Dim targetFolder As String
    Dim baseName As String
    Dim extensionName As String
    Dim dotPos As Long

    On Error GoTo BackupFailed

    sourcePath = doc.FullName

    If Len(sourcePath) = 0 Then Exit Function

    ' Normal local/synced files use the document folder.
    If IsLocalFilePathV35(sourcePath) Then
        targetFolder = doc.Path
    Else
        ' Cloud/URL documents cannot be read by normal VBA file I/O.
        ' Use Word's default Documents folder for the local safety copy.
        targetFolder = Options.DefaultFilePath(wdDocumentsPath)
    End If

    If Len(targetFolder) = 0 Then
        targetFolder = Environ$("USERPROFILE") & _
                       Application.PathSeparator & "Documents"
    End If

    dotPos = InStrRev(doc.Name, ".")

    If dotPos > 0 Then
        baseName = Left$(doc.Name, dotPos - 1)
        extensionName = Mid$(doc.Name, dotPos)
    Else
        baseName = doc.Name
        extensionName = ".docm"
    End If

    targetFile = BuildUniqueBackupPathV35( _
        targetFolder, baseName, extensionName)

    ' ------------------------------------------------------------
    ' Method 1: binary shared-read copy.
    '
    ' Unlike VBA FileCopy, this opens the currently open Word file
    ' for shared read access and copies it in 1 MB blocks.
    ' ------------------------------------------------------------
    If IsLocalFilePathV35(sourcePath) Then
        If CopyOpenFileBinarySharedV35(sourcePath, targetFile) Then
            If VerifyBackupFileV35(sourcePath, targetFile, True) Then
                CreateVerifiedBackupV35 = True
                Exit Function
            End If
        End If
    End If

    DeletePartialBackupV35 targetFile

    ' ------------------------------------------------------------
    ' Method 2: FileSystemObject.CopyFile fallback.
    ' ------------------------------------------------------------
    If IsLocalFilePathV35(sourcePath) Then
        If CopyWithFileSystemObjectV35(sourcePath, targetFile) Then
            If VerifyBackupFileV35(sourcePath, targetFile, True) Then
                CreateVerifiedBackupV35 = True
                Exit Function
            End If
        End If
    End If

    DeletePartialBackupV35 targetFile

    ' ------------------------------------------------------------
    ' Method 3: Word SaveCopyAs fallback.
    ' This is also the only practical fallback for a cloud/URL source.
    ' ------------------------------------------------------------
    If SaveCopyWithWordV35(doc, targetFile) Then
        If VerifyBackupFileV35(sourcePath, targetFile, _
                               IsLocalFilePathV35(sourcePath)) Then

            CreateVerifiedBackupV35 = True
            Exit Function
        End If
    End If

BackupFailed:
    CreateVerifiedBackupV35 = False

End Function

Private Function IsLocalFilePathV35( _
                    ByVal filePath As String) As Boolean

    Dim lowerPath As String

    lowerPath = LCase$(Trim$(filePath))

    If Left$(lowerPath, 7) = "http://" Or _
       Left$(lowerPath, 8) = "https://" Then

        Exit Function
    End If

    If Left$(lowerPath, 5) = "ms-" Then Exit Function

    IsLocalFilePathV35 = True

End Function

Private Function BuildUniqueBackupPathV35( _
                    ByVal folderPath As String, _
                    ByVal baseName As String, _
                    ByVal extensionName As String) As String

    Dim candidate As String
    Dim suffixNumber As Long
    Dim stampText As String

    stampText = Format$(Now, "yyyymmdd_hhnnss")

    candidate = folderPath & Application.PathSeparator & _
                baseName & "_BACKUP_BEFORE_FORMAT_" & _
                stampText & extensionName

    If Len(Dir$(candidate)) = 0 Then
        BuildUniqueBackupPathV35 = candidate
        Exit Function
    End If

    suffixNumber = 2

    Do
        candidate = folderPath & Application.PathSeparator & _
                    baseName & "_BACKUP_BEFORE_FORMAT_" & _
                    stampText & "_" & CStr(suffixNumber) & _
                    extensionName

        If Len(Dir$(candidate)) = 0 Then Exit Do

        suffixNumber = suffixNumber + 1
    Loop

    BuildUniqueBackupPathV35 = candidate

End Function

Private Function CopyOpenFileBinarySharedV35( _
                    ByVal sourcePath As String, _
                    ByVal targetPath As String) As Boolean

    Const CHUNK_SIZE As Long = 1048576

    Dim sourceNumber As Integer
    Dim targetNumber As Integer
    Dim sourceLength As Long
    Dim currentPosition As Long
    Dim bytesToRead As Long
    Dim buffer() As Byte

    On Error GoTo CopyFailed

    sourceNumber = FreeFile
    Open sourcePath For Binary Access Read Shared As #sourceNumber

    sourceLength = LOF(sourceNumber)

    targetNumber = FreeFile
    Open targetPath For Binary Access Write Lock Write As #targetNumber

    currentPosition = 1

    Do While currentPosition <= sourceLength

        bytesToRead = sourceLength - currentPosition + 1

        If bytesToRead > CHUNK_SIZE Then
            bytesToRead = CHUNK_SIZE
        End If

        ReDim buffer(1 To bytesToRead) As Byte

        Get #sourceNumber, currentPosition, buffer
        Put #targetNumber, currentPosition, buffer

        currentPosition = currentPosition + bytesToRead
    Loop

    Close #targetNumber
    targetNumber = 0

    Close #sourceNumber
    sourceNumber = 0

    CopyOpenFileBinarySharedV35 = True
    Exit Function

CopyFailed:
    On Error Resume Next

    If targetNumber <> 0 Then Close #targetNumber
    If sourceNumber <> 0 Then Close #sourceNumber

    On Error GoTo 0
    CopyOpenFileBinarySharedV35 = False

End Function

Private Function CopyWithFileSystemObjectV35( _
                    ByVal sourcePath As String, _
                    ByVal targetPath As String) As Boolean

    Dim fso As Object

    On Error GoTo CopyFailed

    Set fso = CreateObject("Scripting.FileSystemObject")
    fso.CopyFile sourcePath, targetPath, True

    CopyWithFileSystemObjectV35 = _
        (Len(Dir$(targetPath)) > 0)

    Exit Function

CopyFailed:
    CopyWithFileSystemObjectV35 = False

End Function

Private Function SaveCopyWithWordV35( _
                    ByVal doc As Document, _
                    ByVal targetPath As String) As Boolean

    On Error GoTo SaveCopyFailed

    doc.SaveCopyAs targetPath

    SaveCopyWithWordV35 = _
        (Len(Dir$(targetPath)) > 0)

    Exit Function

SaveCopyFailed:
    SaveCopyWithWordV35 = False

End Function

Private Function VerifyBackupFileV35( _
                    ByVal sourcePath As String, _
                    ByVal targetPath As String, _
                    ByVal compareSizeToSource As Boolean) As Boolean

    Dim sourceSize As Long
    Dim targetSize As Long

    On Error GoTo VerifyFailed

    If Len(Dir$(targetPath)) = 0 Then Exit Function

    targetSize = FileLen(targetPath)

    If targetSize <= 0 Then Exit Function

    If compareSizeToSource Then
        sourceSize = FileLen(sourcePath)

        If sourceSize <= 0 Then Exit Function
        If targetSize <> sourceSize Then Exit Function
    End If

    VerifyBackupFileV35 = True
    Exit Function

VerifyFailed:
    VerifyBackupFileV35 = False

End Function

Private Sub DeletePartialBackupV35( _
                    ByVal targetPath As String)

    On Error Resume Next

    If Len(targetPath) > 0 Then
        If Len(Dir$(targetPath)) > 0 Then
            Kill targetPath
        End If
    End If

    On Error GoTo 0

End Sub

Private Sub ApplyPageSetupToAllSections(ByVal doc As Document)

    Dim sec As Section

    For Each sec In doc.Sections
        With sec.PageSetup
            .MirrorMargins = False
            .Gutter = 0

            .TopMargin = Application.CentimetersToPoints(3.2)
            .BottomMargin = Application.CentimetersToPoints(2.7)
            .LeftMargin = Application.CentimetersToPoints(2.75)
            .RightMargin = Application.CentimetersToPoints(2.75)

            ' V35: use the same header/footer distances for BOTH
            ' portrait and landscape sections.
            .HeaderDistance = Application.CentimetersToPoints(2.4)
            .FooterDistance = Application.CentimetersToPoints(2.2)
        End With
    Next sec

End Sub

Private Sub ApplyHeaderFooterDistancesOnlyV35( _
                    ByVal doc As Document)

    Dim sec As Section

    For Each sec In doc.Sections
        With sec.PageSetup
            .HeaderDistance = Application.CentimetersToPoints(2.4)
            .FooterDistance = Application.CentimetersToPoints(2.2)
        End With
    Next sec

End Sub



Private Sub FormatAllHeadersV35( _
                    ByVal doc As Document, _
                    ByRef formattedCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim sec As Section
    Dim headerItem As HeaderFooter
    Dim shp As Shape

    For Each sec In doc.Sections

        For Each headerItem In sec.Headers

            On Error GoTo HeaderError

            If headerItem.Exists Then

                FormatOneHeaderRangeV35 headerItem.Range

                ' Text placed in a text box/shape in the header is a
                ' separate text story and is not always covered by the
                ' normal HeaderFooter.Range formatting.
                For Each shp In headerItem.Shapes
                    FormatHeaderShapeTextV35 shp
                Next shp

                formattedCount = formattedCount + 1
            End If

ContinueHeader:
            On Error GoTo 0
        Next headerItem

        If formattedCount Mod 20 = 0 And formattedCount > 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(formattedCount, "#,##0") & _
                " header ranges formatted"
            DoEvents
        End If

    Next sec

    Exit Sub

HeaderError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueHeader

End Sub

Private Sub FormatOneHeaderRangeV35( _
                    ByVal headerRange As Range)

    Dim para As Paragraph

    On Error Resume Next

    ApplyHeaderFontV35 headerRange

    ' Apply indentation paragraph-by-paragraph. This is more reliable
    ' than assigning mixed ParagraphFormat properties to the whole
    ' header story in one operation.
    For Each para In headerRange.Paragraphs
        ResetHeaderParagraphIndentV35 para.Range
    Next para

    On Error GoTo 0

End Sub

Private Sub ApplyHeaderFontV35( _
                    ByVal targetRange As Range)

    On Error Resume Next

    With targetRange.Font
        .NameFarEast = FontFangSongGB2312Name()
        .NameAscii = EN_FONT
        .NameOther = EN_FONT
        .NameBi = EN_FONT
        .Size = 10.5
        .Bold = False
        .BoldBi = False
    End With

    On Error GoTo 0

End Sub

Private Sub ResetHeaderParagraphIndentV35( _
                    ByVal targetRange As Range)

    On Error Resume Next

    With targetRange.ParagraphFormat
        ' Point-based indentation.
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0

        ' Chinese character-unit indentation.
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
    End With

    On Error GoTo 0

End Sub

Private Sub FormatHeaderShapeTextV35( _
                    ByVal shp As Shape)

    Dim textRange As Range
    Dim para As Paragraph

    On Error Resume Next

    If shp.TextFrame.HasText Then
        Set textRange = shp.TextFrame.TextRange

        If Not textRange Is Nothing Then
            ApplyHeaderFontV35 textRange

            For Each para In textRange.Paragraphs
                ResetHeaderParagraphIndentV35 para.Range
            Next para
        End If
    End If

    On Error GoTo 0

End Sub

Private Sub PurgeOldStylesBeforeRebuildV35( _
                    ByVal doc As Document, _
                    ByRef deletedCount As Long, _
                    ByRef failedDeleteCount As Long, _
                    ByRef hiddenCount As Long)

    Const GROW_BY As Long = 128

    Dim names() As String
    Dim nameCount As Long
    Dim capacity As Long

    Dim sty As Style
    Dim styleTypeValue As Long
    Dim i As Long
    Dim protectedStyles As Object

    capacity = GROW_BY
    ReDim names(1 To capacity)

    ' Preserve custom paragraph styles that are actively used outside
    ' the main story (headers, footers, footnotes, endnotes, text boxes).
    ' They remain hidden from Quick Styles, but are not deleted.
    Set protectedStyles = BuildProtectedNonMainStyleMapV35(doc)

    ' First take a snapshot. Never delete while enumerating doc.Styles.
    For Each sty In doc.Styles

        On Error Resume Next

        sty.QuickStyle = False
        sty.UnhideWhenUsed = False

        If Err.Number = 0 Then
            hiddenCount = hiddenCount + 1
        End If

        Err.Clear

        If Not sty.BuiltIn Then

            styleTypeValue = sty.Type

            If styleTypeValue = wdStyleTypeParagraph Or _
               styleTypeValue = wdStyleTypeLinked Or _
               styleTypeValue = wdStyleTypeList Then

                If Not protectedStyles.Exists(sty.NameLocal) Then
                    nameCount = nameCount + 1

                    If nameCount > capacity Then
                        capacity = capacity + GROW_BY
                        ReDim Preserve names(1 To capacity)
                    End If

                    names(nameCount) = sty.NameLocal
                End If
            End If
        End If

        Err.Clear
        On Error GoTo 0

    Next sty

    For i = 1 To nameCount

        Set sty = Nothing

        On Error Resume Next
        Set sty = doc.Styles(names(i))

        If Not sty Is Nothing Then
            Err.Clear
            sty.Delete

            If Err.Number = 0 Then
                deletedCount = deletedCount + 1
            Else
                failedDeleteCount = failedDeleteCount + 1

                Err.Clear
                sty.QuickStyle = False
                sty.UnhideWhenUsed = False
            End If
        End If

        Err.Clear
        On Error GoTo 0

    Next i

End Sub

Private Function BuildProtectedNonMainStyleMapV35( _
                    ByVal doc As Document) As Object

    Dim result As Object
    Dim rootStory As Range
    Dim storyRange As Range
    Dim para As Paragraph
    Dim sty As Style

    Set result = CreateObject("Scripting.Dictionary")
    result.CompareMode = vbTextCompare

    On Error Resume Next

    For Each rootStory In doc.StoryRanges

        Set storyRange = rootStory

        Do While Not storyRange Is Nothing

            If storyRange.StoryType <> wdMainTextStory Then

                For Each para In storyRange.Paragraphs

                    Set sty = Nothing
                    Set sty = para.Range.Style

                    If Not sty Is Nothing Then
                        If Len(sty.NameLocal) > 0 Then
                            result(sty.NameLocal) = True
                        End If
                    End If
                Next para
            End If

            Set storyRange = storyRange.NextStoryRange
        Loop
    Next rootStory

    On Error GoTo 0

    Set BuildProtectedNonMainStyleMapV35 = result

End Function

Private Function EnsureParagraphStyle(ByVal doc As Document, _
                                      ByVal styleName As String) As Style

    Dim sty As Style
    Dim renamedStyleName As String

    On Error Resume Next
    Set sty = doc.Styles(styleName)
    On Error GoTo 0

    ' If the required style does not exist, create it explicitly.
    If sty Is Nothing Then
        Set sty = doc.Styles.Add(styleName, wdStyleTypeParagraph)
    End If

    ' If the name is occupied by a user-defined non-paragraph style,
    ' preserve that style under a new name and create the required
    ' paragraph style with the correct name.
    If Not sty Is Nothing Then
        If sty.Type <> wdStyleTypeParagraph And _
           sty.Type <> wdStyleTypeLinked Then

            If sty.BuiltIn Then
                Err.Raise vbObjectError + 3201, _
                          "EnsureParagraphStyle", _
                          "A built-in non-paragraph style uses a required style name."
            End If

            renamedStyleName = styleName & "_OLD_" & _
                               Format$(Now, "yyyymmdd_hhnnss")

            sty.NameLocal = renamedStyleName
            Set sty = doc.Styles.Add(styleName, wdStyleTypeParagraph)
        End If
    End If

    If sty Is Nothing Then
        Err.Raise vbObjectError + 3202, _
                  "EnsureParagraphStyle", _
                  "Word could not create the required paragraph style: " & styleName
    End If

    Set EnsureParagraphStyle = sty

End Function

Private Sub ConfigureBodyStyle(ByVal doc As Document, ByVal sty As Style)

    With sty
        .AutomaticallyUpdate = False

        If StrComp(.NameLocal, _
                   doc.Styles(wdStyleNormal).NameLocal, _
                   vbTextCompare) <> 0 Then
            .BaseStyle = doc.Styles(wdStyleNormal).NameLocal
        End If

        .NextParagraphStyle = sty.NameLocal

        SetStyleFont .Font, FontFangSongGB2312Name(), "FangSong", 14

        With .ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphJustify
            .SpaceBefore = 0
            .SpaceAfter = 0
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = 24
            .LeftIndent = 0
            .RightIndent = 0
            .FirstLineIndent = 0
            .CharacterUnitFirstLineIndent = 2
            .DisableLineHeightGrid = True
        End With
    End With

    ShowKeptStyle sty, 6

End Sub

Private Sub ConfigureHeadingStyle(ByVal sty As Style, _
                                  ByVal baseStyle As Style, _
                                  ByVal outlineLevel As WdOutlineLevel, _
                                  ByVal fontSize As Single, _
                                  ByVal exactLineSpacing As Single, _
                                  ByVal priority As Long)

    With sty
        .AutomaticallyUpdate = False
        .BaseStyle = baseStyle.NameLocal
        .NextParagraphStyle = baseStyle.NameLocal

        SetStyleFont .Font, FontHeiTiName(), "SimHei", fontSize

        With .ParagraphFormat
            .OutlineLevel = outlineLevel
            .Alignment = wdAlignParagraphLeft
            .SpaceBefore = 6
            .SpaceAfter = 6
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = exactLineSpacing
            .LeftIndent = 0
            .RightIndent = 0
            .FirstLineIndent = 0
            .CharacterUnitFirstLineIndent = 0
            .DisableLineHeightGrid = True
            .KeepWithNext = True
            .KeepTogether = True
        End With
    End With

    ShowKeptStyle sty, priority

End Sub

Private Sub ConfigureCaptionStyle(ByVal sty As Style, _
                                  ByVal baseStyle As Style)

    With sty
        .AutomaticallyUpdate = False
        .BaseStyle = baseStyle.NameLocal
        .NextParagraphStyle = baseStyle.NameLocal

        SetStyleFont .Font, FontHeiTiName(), "SimHei", 12

        With .ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphLeft
            .SpaceBefore = 0
            .SpaceAfter = 10
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = 20
            .LeftIndent = 0
            .RightIndent = 0
            .FirstLineIndent = 0
            .CharacterUnitFirstLineIndent = 0
            .DisableLineHeightGrid = True
        End With
    End With

    ShowKeptStyle sty, 5

End Sub

Private Sub ConfigureFigureCaptionStyleV35( _
                    ByVal sty As Style, _
                    ByVal baseCaptionStyle As Style, _
                    ByVal nextStyle As Style)

    With sty
        .AutomaticallyUpdate = False
        .BaseStyle = nextStyle.NameLocal
        .NextParagraphStyle = nextStyle.NameLocal

        SetStyleFont .Font, FontHeiTiName(), "SimHei", 12
        .Font.Bold = False

        With .ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphCenter
            .SpaceBefore = 0
            .SpaceAfter = 10
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = 20
            .LeftIndent = 0
            .RightIndent = 0
            .CharacterUnitLeftIndent = 0
            .CharacterUnitRightIndent = 0
            .CharacterUnitFirstLineIndent = 0
            .FirstLineIndent = 0
            .DisableLineHeightGrid = True
            .KeepTogether = True
            .KeepWithNext = False
        End With
    End With

    ShowKeptStyle sty, 7

End Sub

Private Sub ConfigureTableCaptionStyleV35( _
                    ByVal sty As Style, _
                    ByVal baseCaptionStyle As Style, _
                    ByVal nextStyle As Style)

    With sty
        .AutomaticallyUpdate = False
        .BaseStyle = nextStyle.NameLocal
        .NextParagraphStyle = nextStyle.NameLocal

        SetStyleFont .Font, FontHeiTiName(), "SimHei", 12
        .Font.Bold = False

        With .ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphCenter
            .SpaceBefore = 10
            .SpaceAfter = 0
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = 20
            .LeftIndent = 0
            .RightIndent = 0
            .CharacterUnitLeftIndent = 0
            .CharacterUnitRightIndent = 0
            .CharacterUnitFirstLineIndent = 0
            .FirstLineIndent = 0
            .DisableLineHeightGrid = True
            .KeepTogether = True
            .KeepWithNext = True
        End With
    End With

    ShowKeptStyle sty, 8

End Sub

Private Sub SetStyleFont(ByVal targetFont As Font, _
                         ByVal preferredFarEastFont As String, _
                         ByVal fallbackFarEastFont As String, _
                         ByVal fontSize As Single)

    On Error Resume Next

    Err.Clear
    targetFont.NameFarEast = preferredFarEastFont

    If Err.Number <> 0 Then
        Err.Clear
        targetFont.NameFarEast = fallbackFarEastFont
    End If

    Err.Clear
    targetFont.NameAscii = EN_FONT
    targetFont.NameOther = EN_FONT
    targetFont.NameBi = EN_FONT
    targetFont.Size = fontSize
    targetFont.Bold = False
    targetFont.Italic = False
    targetFont.Color = wdColorAutomatic

    On Error GoTo 0

End Sub

' Return values:
' -1 = preserve and skip
'  0 = body
'  1 = heading level 1
'  2 = heading level 2
'  3 = heading level 3
'  4 = heading level 4
'  5 = caption
Private Sub RestoreRuntimeSettings(ByVal doc As Document, _
                                   ByVal oldTrackRevisions As Boolean, _
                                   ByVal oldScreenUpdating As Boolean, _
                                   ByVal oldCheckSpelling As Boolean, _
                                   ByVal oldCheckGrammar As Boolean)

    On Error Resume Next
    doc.TrackRevisions = oldTrackRevisions
    Options.CheckSpellingAsYouType = oldCheckSpelling
    Options.CheckGrammarAsYouType = oldCheckGrammar
    Application.ScreenUpdating = oldScreenUpdating
    Application.StatusBar = False
    On Error GoTo 0

End Sub








' ============================================================
' V35 ORIGINAL-BODY GUARD
'
' Body bookmarks are temporary internal guards. They track the ranges
' even when heading-number text is deleted later in the document.
' This lets V35 enforce the original Body classification after the
' heading list template has been attached.
' ============================================================

Private Function CreateBodyGuardBookmarksV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByVal runCount As Long, _
                    ByRef bookmarkNames() As String) As Long

    Dim i As Long
    Dim bookmarkName As String
    Dim targetRange As Range

    If runCount <= 0 Then Exit Function

    ReDim bookmarkNames(1 To runCount)

    For i = 1 To runCount

        bookmarkName = "_V35BODY_" & Format$(i, "000000")
        bookmarkNames(i) = bookmarkName

        On Error Resume Next

        If doc.Bookmarks.Exists(bookmarkName) Then
            doc.Bookmarks(bookmarkName).Delete
        End If

        Set targetRange = doc.Range(starts(i), ends(i))
        doc.Bookmarks.Add Name:=bookmarkName, Range:=targetRange

        On Error GoTo 0

        If i Mod 250 = 0 Then DoEvents
    Next i

    CreateBodyGuardBookmarksV35 = runCount

End Function

Private Sub ReassertBodyGuardBookmarksV35( _
                    ByVal doc As Document, _
                    ByRef bookmarkNames() As String, _
                    ByVal bookmarkCount As Long, _
                    ByVal styBody As Style, _
                    ByVal headingTemplate As ListTemplate, _
                    ByRef repairedRangeCount As Long, _
                    ByRef removedHeadingListCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim guardRange As Range
    Dim para As Paragraph

    If bookmarkCount <= 0 Then Exit Sub

    For i = 1 To bookmarkCount

        If doc.Bookmarks.Exists(bookmarkNames(i)) Then

            Set guardRange = doc.Bookmarks(bookmarkNames(i)).Range.Duplicate

            For Each para In guardRange.Paragraphs

                ' Preserve ordinary body numbering/lists.
                ' Remove numbering ONLY if this Body paragraph has somehow
                ' acquired V35's new heading list template.
                If ParagraphUsesListTemplateV35( _
                        para, headingTemplate) Then

                    On Error Resume Next
                    para.Range.ListFormat.RemoveNumbers _
                        NumberType:=wdNumberParagraph
                    On Error GoTo 0

                    removedHeadingListCount = _
                        removedHeadingListCount + 1
                End If

                ForceParagraphToBodyV35 para, styBody
            Next para

            repairedRangeCount = repairedRangeCount + 1
        End If

        If i Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(i, "#,##0") & _
                " / " & Format$(bookmarkCount, "#,##0")
            DoEvents
        End If
    Next i

End Sub

Private Function ParagraphUsesListTemplateV35( _
                    ByVal para As Paragraph, _
                    ByVal targetTemplate As ListTemplate) As Boolean

    Dim currentTemplate As ListTemplate

    On Error GoTo SafeExit

    If para.Range.ListFormat.ListType = wdListNoNumbering Then _
        Exit Function

    Set currentTemplate = para.Range.ListFormat.ListTemplate

    If Not currentTemplate Is Nothing Then
        If currentTemplate Is targetTemplate Then
            ParagraphUsesListTemplateV35 = True
        End If
    End If

SafeExit:
End Function

Private Sub ForceParagraphToBodyV35( _
                    ByVal para As Paragraph, _
                    ByVal styBody As Style)

    On Error Resume Next

    para.Range.Style = styBody.NameLocal

    With para.Range.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphJustify
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 24
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
        .CharacterUnitFirstLineIndent = 2
        .DisableLineHeightGrid = True
    End With

    On Error GoTo 0

End Sub

Private Sub DeleteBodyGuardBookmarksV35( _
                    ByVal doc As Document, _
                    ByRef bookmarkNames() As String, _
                    ByVal bookmarkCount As Long)

    Dim i As Long

    If bookmarkCount <= 0 Then Exit Sub

    On Error Resume Next

    For i = 1 To bookmarkCount
        If doc.Bookmarks.Exists(bookmarkNames(i)) Then
            doc.Bookmarks(bookmarkNames(i)).Delete
        End If
    Next i

    On Error GoTo 0

End Sub

' ============================================================
' V35 OUTLINE-LEVEL-ONLY HEADING ENGINE
'
' Heading classification rule:
'   OutlineLevel 1 -> Style 1
'   OutlineLevel 2 -> Style 2
'   OutlineLevel 3 -> Style 3
'   OutlineLevel 4 -> Style 4
'   Body Text       -> Body
'
' Numeric text prefixes NEVER create headings.
' Existing style names NEVER create headings by themselves.
' Captions are still detected before heading classification.
' ============================================================

Private Function BuildOutlineStructureMapV35( _
                    ByVal doc As Document, _
                    ByRef bodyRunStarts() As Long, _
                    ByRef bodyRunEnds() As Long, _
                    ByRef bodyRunParagraphCounts() As Long, _
                    ByRef bodyRunCount As Long, _
                    ByRef specialStarts() As Long, _
                    ByRef specialKinds() As Integer, _
                    ByRef bodyParagraphCount As Long, _
                    ByRef headingLocatedCount As Long, _
                    ByRef figureLocatedCount As Long, _
                    ByRef tableCaptionLocatedCount As Long, _
                    ByRef genericCaptionCount As Long, _
                    ByVal stepName As String) As Long

    Const RUN_GROW_BY As Long = 256
    Const SPECIAL_GROW_BY As Long = 512
    Const PROGRESS_EVERY As Long = 1500

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim sty As Style

    Dim styleName As String
    Dim textValue As String
    Dim captionKind As Integer
    Dim headingKind As Integer
    Dim originalOutlineLevel As WdOutlineLevel

    Dim pictureParagraphs As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim tableStarts() As Long
    Dim tableEnds() As Long
    Dim tableBoundaryCount As Long
    Dim tableIndex As Long

    Dim runCapacity As Long
    Dim specialCapacity As Long
    Dim specialCount As Long
    Dim scannedCount As Long

    Dim runOpen As Boolean
    Dim runStart As Long
    Dim runEnd As Long
    Dim runParagraphs As Long

    runCapacity = RUN_GROW_BY
    specialCapacity = SPECIAL_GROW_BY

    ReDim bodyRunStarts(1 To runCapacity)
    ReDim bodyRunEnds(1 To runCapacity)
    ReDim bodyRunParagraphCounts(1 To runCapacity)

    ReDim specialStarts(1 To specialCapacity)
    ReDim specialKinds(1 To specialCapacity)

    Set pictureParagraphs = CreateObject("Scripting.Dictionary")
    BuildPictureParagraphMapSafeV35 doc, pictureParagraphs

    BuildTableOfContentsBoundaries _
        doc, tocStarts, tocEnds, tocCount

    BuildTableBoundariesV35 _
        doc, tableStarts, tableEnds, tableBoundaryCount

    tocIndex = 1
    tableIndex = 1

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' V35 authoritative rule:
    ' capture the ORIGINAL paragraph OutlineLevel before any style cleanup.
    ' This value alone decides Body versus Style 1-4.
    ' Numeric prefixes and old heading-style names have zero authority.
    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1
        Set paraRange = para.Range.Duplicate

        If PositionInsideSequentialRangesV35( _
                paraRange.Start, tableStarts, tableEnds, _
                tableBoundaryCount, tableIndex) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        ElseIf PositionInsideSequentialRangesV35( _
                paraRange.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        ElseIf pictureParagraphs.Exists(CStr(paraRange.Start)) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        Else
            Set sty = Nothing
            styleName = ""

            On Error Resume Next
            Set sty = paraRange.Style
            If Not sty Is Nothing Then styleName = sty.NameLocal
            On Error GoTo 0

            textValue = QuickParagraphTextV35(paraRange.Text)

            ' Captions are classified first so a caption that accidentally
            ' carries an outline level is never converted into a heading.
            captionKind = CaptionKindStrictV35(styleName, textValue)

            If captionKind = 101 Or captionKind = 102 Then

                CloseBodyRunSafeV35 _
                    runOpen, runStart, runEnd, runParagraphs, _
                    bodyRunStarts, bodyRunEnds, _
                    bodyRunParagraphCounts, bodyRunCount, _
                    runCapacity, RUN_GROW_BY

                specialCount = specialCount + 1
                AddSpecialSafeV35 _
                    specialCount, paraRange.Start, captionKind, _
                    specialStarts, specialKinds, _
                    specialCapacity, SPECIAL_GROW_BY

                If captionKind = 101 Then
                    figureLocatedCount = figureLocatedCount + 1
                Else
                    tableCaptionLocatedCount = _
                        tableCaptionLocatedCount + 1
                End If

            ElseIf IsGenericCaptionStyleV35(styleName) Then

                CloseBodyRunSafeV35 _
                    runOpen, runStart, runEnd, runParagraphs, _
                    bodyRunStarts, bodyRunEnds, _
                    bodyRunParagraphCounts, bodyRunCount, _
                    runCapacity, RUN_GROW_BY

                specialCount = specialCount + 1
                AddSpecialSafeV35 _
                    specialCount, paraRange.Start, 105, _
                    specialStarts, specialKinds, _
                    specialCapacity, SPECIAL_GROW_BY

                genericCaptionCount = genericCaptionCount + 1

            Else
                originalOutlineLevel = wdOutlineLevelBodyText

                On Error Resume Next
                originalOutlineLevel = para.OutlineLevel
                On Error GoTo 0

                headingKind = HeadingLevelFromOutlineOnlyV35( _
                    originalOutlineLevel)

                If headingKind >= 1 And headingKind <= 4 Then

                    CloseBodyRunSafeV35 _
                        runOpen, runStart, runEnd, runParagraphs, _
                        bodyRunStarts, bodyRunEnds, _
                        bodyRunParagraphCounts, bodyRunCount, _
                        runCapacity, RUN_GROW_BY

                    specialCount = specialCount + 1
                    AddSpecialSafeV35 _
                        specialCount, paraRange.Start, headingKind, _
                        specialStarts, specialKinds, _
                        specialCapacity, SPECIAL_GROW_BY

                    headingLocatedCount = headingLocatedCount + 1

                Else
                    ' Body-outline paragraph stays Body regardless of:
                    ' 1. ...
                    ' 1.1 ...
                    ' 1) ...
                    ' 7.5MW ...
                    ' CWT7500-D221-H160 ...
                    If Not runOpen Then
                        runOpen = True
                        runStart = paraRange.Start
                        runParagraphs = 0
                    End If

                    runEnd = paraRange.End
                    runParagraphs = runParagraphs + 1
                    bodyParagraphCount = bodyParagraphCount + 1
                End If
            End If
        End If

        If scannedCount Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; outline headings " & _
                Format$(headingLocatedCount, "#,##0") & _
                "; captions " & _
                Format$(figureLocatedCount + _
                        tableCaptionLocatedCount, "#,##0")
            DoEvents
        End If

    Next para

    CloseBodyRunSafeV35 _
        runOpen, runStart, runEnd, runParagraphs, _
        bodyRunStarts, bodyRunEnds, bodyRunParagraphCounts, _
        bodyRunCount, runCapacity, RUN_GROW_BY

    If bodyRunCount > 0 Then
        ReDim Preserve bodyRunStarts(1 To bodyRunCount)
        ReDim Preserve bodyRunEnds(1 To bodyRunCount)
        ReDim Preserve bodyRunParagraphCounts(1 To bodyRunCount)
    End If

    If specialCount > 0 Then
        ReDim Preserve specialStarts(1 To specialCount)
        ReDim Preserve specialKinds(1 To specialCount)
    End If

    BuildOutlineStructureMapV35 = specialCount

End Function

Private Function HeadingLevelFromOutlineOnlyV35( _
                    ByVal outlineLevel As WdOutlineLevel) As Integer

    Select Case outlineLevel
        Case wdOutlineLevel1
            HeadingLevelFromOutlineOnlyV35 = 1
        Case wdOutlineLevel2
            HeadingLevelFromOutlineOnlyV35 = 2
        Case wdOutlineLevel3
            HeadingLevelFromOutlineOnlyV35 = 3
        Case wdOutlineLevel4
            HeadingLevelFromOutlineOnlyV35 = 4
        Case Else
            HeadingLevelFromOutlineOnlyV35 = 0
    End Select

End Function

Private Sub ProcessSpecialParagraphsOutlineV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByVal specialCount As Long, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef headingCount As Long, _
                    ByRef headingErrorCount As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByRef figureCount As Long, _
                    ByRef tableCaptionCount As Long, _
                    ByRef captionErrorCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim pointRange As Range
    Dim para As Paragraph
    Dim specialKind As Integer

    For i = specialCount To 1 Step -1

        specialKind = kinds(i)

        On Error GoTo SpecialError

        Set pointRange = doc.Range(starts(i), starts(i))
        Set para = pointRange.Paragraphs(1)

        If specialKind >= 1 And specialKind <= 4 Then

            If ApplyOutlineConfirmedHeadingStyleV35( _
                    para, specialKind, _
                    styH1, styH2, styH3, styH4) Then

                headingCount = headingCount + 1

                If specialKind = 4 Then
                    level4Count = level4Count + 1
                End If
            Else
                headingErrorCount = headingErrorCount + 1

                If specialKind = 4 Then
                    level4ErrorCount = level4ErrorCount + 1
                End If
            End If

        ElseIf specialKind = 101 Then

            CleanCaptionAndApplyStyleV35 _
                para, 1, styFigureCaption

            figureCount = figureCount + 1

        ElseIf specialKind = 102 Then

            CleanCaptionAndApplyStyleV35 _
                para, 2, styTableCaption

            tableCaptionCount = tableCaptionCount + 1

        ElseIf specialKind = 105 Then

            On Error Resume Next
            para.Range.ListFormat.RemoveNumbers _
                NumberType:=wdNumberParagraph

            para.Range.ParagraphFormat.Reset
            para.Range.Font.Reset
            para.Range.Style = styCaption.NameLocal
            On Error GoTo SpecialError
        End If

ContinueSpecial:
        On Error GoTo 0

        If i Mod 250 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(specialCount - i + 1, "#,##0") & _
                " / " & Format$(specialCount, "#,##0")
            DoEvents
        End If

    Next i

    Exit Sub

SpecialError:
    If specialKind = 101 Or specialKind = 102 Then
        captionErrorCount = captionErrorCount + 1
    Else
        headingErrorCount = headingErrorCount + 1
    End If

    Err.Clear
    Resume ContinueSpecial

End Sub

Private Function ApplyOutlineConfirmedHeadingStyleV35( _
                    ByVal para As Paragraph, _
                    ByVal headingLevel As Integer, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style) As Boolean

    Dim targetStyle As Style

    On Error GoTo HeadingError

    Select Case headingLevel
        Case 1
            Set targetStyle = styH1
        Case 2
            Set targetStyle = styH2
        Case 3
            Set targetStyle = styH3
        Case 4
            Set targetStyle = styH4
        Case Else
            Exit Function
    End Select

    ' Because the heading has already been confirmed by ORIGINAL
    ' outline level, it is safe to remove any old numbering here.
    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo HeadingError

    StripConfirmedHeadingNumberV35 para

    para.Range.ParagraphFormat.Reset
    para.Range.Font.Reset
    para.Range.Style = targetStyle.NameLocal

    ApplyOutlineConfirmedHeadingStyleV35 = True
    Exit Function

HeadingError:
    ApplyOutlineConfirmedHeadingStyleV35 = False

End Function

Private Sub StripConfirmedHeadingNumberV35( _
                    ByVal para As Paragraph)

    Dim contentRange As Range
    Dim textValue As String
    Dim removeLength As Long
    Dim passNumber As Integer

    ' Repeated cleanup handles old automatic-number conversions such as:
    '   5.5.3.3  5.5.3.3  Title
    For passNumber = 1 To 3

        Set contentRange = para.Range.Duplicate

        Do While contentRange.End > contentRange.Start
            If Right$(contentRange.Text, 1) = Chr$(13) Or _
               Right$(contentRange.Text, 1) = Chr$(7) Then

                contentRange.MoveEnd wdCharacter, -1
            Else
                Exit Do
            End If
        Loop

        textValue = contentRange.Text
        removeLength = ConfirmedHeadingPrefixLengthV35(textValue)

        If removeLength <= 0 Then Exit For

        contentRange.End = contentRange.Start + removeLength
        contentRange.Delete

    Next passNumber

End Sub

Private Function ConfirmedHeadingPrefixLengthV35( _
                    ByVal textValue As String) As Long

    Dim i As Long
    Dim n As Long
    Dim groupCount As Integer
    Dim digitCount As Integer
    Dim ch As String
    Dim separatorSeen As Boolean
    Dim spacesSeen As Boolean
    Dim punctuationSeen As Boolean

    n = Len(textValue)
    i = 1

    ' Include leading whitespace.
    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    Do
        digitCount = 0

        Do While i <= n
            ch = Mid$(textValue, i, 1)

            If ch >= "0" And ch <= "9" Then
                digitCount = digitCount + 1

                If digitCount > 4 Then Exit Function

                i = i + 1
            Else
                Exit Do
            End If
        Loop

        If digitCount = 0 Then Exit Function

        groupCount = groupCount + 1
        If groupCount > 4 Then Exit Function

        ' Spaces may occur around old pasted separators.
        Do While i <= n
            ch = Mid$(textValue, i, 1)

            If IsHeadingSpaceV35(ch) Then
                spacesSeen = True
                i = i + 1
            Else
                Exit Do
            End If
        Loop

        If i > n Then Exit Function

        ch = Mid$(textValue, i, 1)

        If IsHeadingNumberSeparatorV35(ch) Then
            separatorSeen = True
            punctuationSeen = True
            i = i + 1

            Do While i <= n
                ch = Mid$(textValue, i, 1)

                If IsHeadingSpaceV35(ch) Then
                    spacesSeen = True
                    i = i + 1
                Else
                    Exit Do
                End If
            Loop

            If i > n Then Exit Function

            ch = Mid$(textValue, i, 1)

            If ch >= "0" And ch <= "9" Then
                ' Another number group follows.
            Else
                Exit Do
            End If
        Else
            Exit Do
        End If

    Loop

    ' Confirmed heading: one space after a bare integer is enough.
    ' A separator is also enough, even when old text has no space.
    If Not separatorSeen And Not spacesSeen Then Exit Function
    If i > n Then Exit Function

    ' Consume terminal punctuation/spaces before the title.
    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Or _
           IsTerminalHeadingSeparatorV35(ch) Then

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If i > n Then Exit Function

    ConfirmedHeadingPrefixLengthV35 = i - 1

End Function

' ============================================================
' V35 SAFE + STRICT ENGINE
' ============================================================

Private Function BuildSafeStructureMapV35( _
                    ByVal doc As Document, _
                    ByRef bodyRunStarts() As Long, _
                    ByRef bodyRunEnds() As Long, _
                    ByRef bodyRunParagraphCounts() As Long, _
                    ByRef bodyRunCount As Long, _
                    ByRef specialStarts() As Long, _
                    ByRef specialKinds() As Integer, _
                    ByRef bodyParagraphCount As Long, _
                    ByRef headingLocatedCount As Long, _
                    ByRef figureLocatedCount As Long, _
                    ByRef tableCaptionLocatedCount As Long, _
                    ByRef genericCaptionCount As Long, _
                    ByVal stepName As String) As Long

    Const RUN_GROW_BY As Long = 256
    Const SPECIAL_GROW_BY As Long = 512
    Const PROGRESS_EVERY As Long = 1500

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim sty As Style

    Dim styleName As String
    Dim textValue As String
    Dim captionKind As Integer
    Dim headingKind As Integer

    Dim pictureParagraphs As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim tableStarts() As Long
    Dim tableEnds() As Long
    Dim tableBoundaryCount As Long
    Dim tableIndex As Long

    Dim runCapacity As Long
    Dim specialCapacity As Long
    Dim specialCount As Long
    Dim scannedCount As Long

    Dim runOpen As Boolean
    Dim runStart As Long
    Dim runEnd As Long
    Dim runParagraphs As Long

    runCapacity = RUN_GROW_BY
    specialCapacity = SPECIAL_GROW_BY

    ReDim bodyRunStarts(1 To runCapacity)
    ReDim bodyRunEnds(1 To runCapacity)
    ReDim bodyRunParagraphCounts(1 To runCapacity)

    ReDim specialStarts(1 To specialCapacity)
    ReDim specialKinds(1 To specialCapacity)

    Set pictureParagraphs = CreateObject("Scripting.Dictionary")
    BuildPictureParagraphMapSafeV35 doc, pictureParagraphs

    BuildTableOfContentsBoundaries _
        doc, tocStarts, tocEnds, tocCount

    BuildTableBoundariesV35 _
        doc, tableStarts, tableEnds, tableBoundaryCount

    tocIndex = 1
    tableIndex = 1

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' This scan NEVER changes the document.
    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1
        Set paraRange = para.Range.Duplicate

        If PositionInsideSequentialRangesV35( _
                paraRange.Start, tableStarts, tableEnds, _
                tableBoundaryCount, tableIndex) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        ElseIf PositionInsideSequentialRangesV35( _
                paraRange.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        ElseIf pictureParagraphs.Exists(CStr(paraRange.Start)) Then

            CloseBodyRunSafeV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY

        Else
            Set sty = Nothing
            styleName = ""

            On Error Resume Next
            Set sty = paraRange.Style
            If Not sty Is Nothing Then styleName = sty.NameLocal
            On Error GoTo 0

            textValue = QuickParagraphTextV35(paraRange.Text)

            ' Captions have priority over every heading rule.
            captionKind = CaptionKindStrictV35(styleName, textValue)

            If captionKind = 101 Or captionKind = 102 Then

                CloseBodyRunSafeV35 _
                    runOpen, runStart, runEnd, runParagraphs, _
                    bodyRunStarts, bodyRunEnds, _
                    bodyRunParagraphCounts, bodyRunCount, _
                    runCapacity, RUN_GROW_BY

                specialCount = specialCount + 1
                AddSpecialSafeV35 _
                    specialCount, paraRange.Start, captionKind, _
                    specialStarts, specialKinds, _
                    specialCapacity, SPECIAL_GROW_BY

                If captionKind = 101 Then
                    figureLocatedCount = figureLocatedCount + 1
                Else
                    tableCaptionLocatedCount = _
                        tableCaptionLocatedCount + 1
                End If

            ElseIf IsGenericCaptionStyleV35(styleName) Then

                CloseBodyRunSafeV35 _
                    runOpen, runStart, runEnd, runParagraphs, _
                    bodyRunStarts, bodyRunEnds, _
                    bodyRunParagraphCounts, bodyRunCount, _
                    runCapacity, RUN_GROW_BY

                specialCount = specialCount + 1
                AddSpecialSafeV35 _
                    specialCount, paraRange.Start, 105, _
                    specialStarts, specialKinds, _
                    specialCapacity, SPECIAL_GROW_BY

                genericCaptionCount = genericCaptionCount + 1

            Else
                headingKind = HeadingKindStrictV35( _
                    styleName, textValue)

                If headingKind >= 1 And headingKind <= 4 Then

                    CloseBodyRunSafeV35 _
                        runOpen, runStart, runEnd, runParagraphs, _
                        bodyRunStarts, bodyRunEnds, _
                        bodyRunParagraphCounts, bodyRunCount, _
                        runCapacity, RUN_GROW_BY

                    specialCount = specialCount + 1
                    AddSpecialSafeV35 _
                        specialCount, paraRange.Start, headingKind, _
                        specialStarts, specialKinds, _
                        specialCapacity, SPECIAL_GROW_BY

                    headingLocatedCount = headingLocatedCount + 1

                Else
                    If Not runOpen Then
                        runOpen = True
                        runStart = paraRange.Start
                        runParagraphs = 0
                    End If

                    runEnd = paraRange.End
                    runParagraphs = runParagraphs + 1
                    bodyParagraphCount = bodyParagraphCount + 1
                End If
            End If
        End If

        If scannedCount Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; headings " & _
                Format$(headingLocatedCount, "#,##0") & _
                "; captions " & _
                Format$(figureLocatedCount + _
                        tableCaptionLocatedCount, "#,##0")
            DoEvents
        End If

    Next para

    CloseBodyRunSafeV35 _
        runOpen, runStart, runEnd, runParagraphs, _
        bodyRunStarts, bodyRunEnds, bodyRunParagraphCounts, _
        bodyRunCount, runCapacity, RUN_GROW_BY

    If bodyRunCount > 0 Then
        ReDim Preserve bodyRunStarts(1 To bodyRunCount)
        ReDim Preserve bodyRunEnds(1 To bodyRunCount)
        ReDim Preserve bodyRunParagraphCounts(1 To bodyRunCount)
    End If

    If specialCount > 0 Then
        ReDim Preserve specialStarts(1 To specialCount)
        ReDim Preserve specialKinds(1 To specialCount)
    End If

    BuildSafeStructureMapV35 = specialCount

End Function

Private Sub BuildTableBoundariesV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByRef count As Long)

    Const GROW_BY As Long = 64

    Dim mainRange As Range
    Dim tbl As Table
    Dim capacity As Long

    capacity = GROW_BY
    ReDim starts(1 To capacity)
    ReDim ends(1 To capacity)

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each tbl In mainRange.Tables
        count = count + 1

        If count > capacity Then
            capacity = capacity + GROW_BY
            ReDim Preserve starts(1 To capacity)
            ReDim Preserve ends(1 To capacity)
        End If

        starts(count) = tbl.Range.Start
        ends(count) = tbl.Range.End
    Next tbl

    If count > 0 Then
        ReDim Preserve starts(1 To count)
        ReDim Preserve ends(1 To count)
    End If

End Sub

Private Function PositionInsideSequentialRangesV35( _
                    ByVal position As Long, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByVal count As Long, _
                    ByRef currentIndex As Long) As Boolean

    If count = 0 Then Exit Function
    If currentIndex < 1 Then currentIndex = 1

    Do While currentIndex <= count
        If position >= ends(currentIndex) Then
            currentIndex = currentIndex + 1
        Else
            Exit Do
        End If
    Loop

    If currentIndex <= count Then
        PositionInsideSequentialRangesV35 = _
            (position >= starts(currentIndex) And _
             position < ends(currentIndex))
    End If

End Function

Private Sub BuildPictureParagraphMapSafeV35( _
                    ByVal doc As Document, _
                    ByVal paragraphMap As Object)

    Dim mainRange As Range
    Dim ils As InlineShape
    Dim shp As Shape
    Dim paraStart As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each ils In mainRange.InlineShapes
        On Error Resume Next
        paraStart = ils.Range.Paragraphs(1).Range.Start
        paragraphMap(CStr(paraStart)) = True
        On Error GoTo 0
    Next ils

    For Each shp In doc.Shapes
        If IsPictureShapeV10(shp) Then
            On Error Resume Next
            paraStart = shp.Anchor.Paragraphs(1).Range.Start
            paragraphMap(CStr(paraStart)) = True
            On Error GoTo 0
        End If
    Next shp

End Sub

Private Sub CloseBodyRunSafeV35( _
                    ByRef runOpen As Boolean, _
                    ByRef runStart As Long, _
                    ByRef runEnd As Long, _
                    ByRef runParagraphs As Long, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByRef counts() As Long, _
                    ByRef runCount As Long, _
                    ByRef capacity As Long, _
                    ByVal growBy As Long)

    If Not runOpen Then Exit Sub

    If runEnd > runStart Then
        runCount = runCount + 1

        If runCount > capacity Then
            capacity = capacity + growBy
            ReDim Preserve starts(1 To capacity)
            ReDim Preserve ends(1 To capacity)
            ReDim Preserve counts(1 To capacity)
        End If

        starts(runCount) = runStart
        ends(runCount) = runEnd
        counts(runCount) = runParagraphs
    End If

    runOpen = False
    runStart = 0
    runEnd = 0
    runParagraphs = 0

End Sub

Private Sub AddSpecialSafeV35( _
                    ByVal recordIndex As Long, _
                    ByVal startPosition As Long, _
                    ByVal specialKind As Integer, _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByRef capacity As Long, _
                    ByVal growBy As Long)

    If recordIndex > capacity Then
        capacity = capacity + growBy
        ReDim Preserve starts(1 To capacity)
        ReDim Preserve kinds(1 To capacity)
    End If

    starts(recordIndex) = startPosition
    kinds(recordIndex) = specialKind

End Sub

Private Function QuickParagraphTextV35( _
                    ByVal rawText As String) As String

    Dim result As String

    result = rawText

    Do While Len(result) > 0
        If Right$(result, 1) = Chr$(13) Or _
           Right$(result, 1) = Chr$(7) Then

            result = Left$(result, Len(result) - 1)
        Else
            Exit Do
        End If
    Loop

    QuickParagraphTextV35 = TrimUnicodeSpacesV35(result)

End Function

Private Function TrimUnicodeSpacesV35( _
                    ByVal textValue As String) As String

    Dim firstPos As Long
    Dim lastPos As Long
    Dim ch As String

    firstPos = 1
    lastPos = Len(textValue)

    Do While firstPos <= lastPos
        ch = Mid$(textValue, firstPos, 1)

        If IsHeadingSpaceV35(ch) Then
            firstPos = firstPos + 1
        Else
            Exit Do
        End If
    Loop

    Do While lastPos >= firstPos
        ch = Mid$(textValue, lastPos, 1)

        If IsHeadingSpaceV35(ch) Then
            lastPos = lastPos - 1
        Else
            Exit Do
        End If
    Loop

    If lastPos >= firstPos Then
        TrimUnicodeSpacesV35 = _
            Mid$(textValue, firstPos, lastPos - firstPos + 1)
    End If

End Function

Private Function FastStyleHeadingLevelV35( _
                    ByVal styleName As String) As Integer

    Dim normalizedName As String

    normalizedName = LCase$(Replace(Trim$(styleName), " ", ""))

    If normalizedName = LCase$(StyleH1Name()) Or _
       normalizedName = "heading1" Or _
       normalizedName = LCase$(U("6807 9898") & "1") Or _
       normalizedName = LCase$(U("4E00 7EA7 6807 9898")) Then

        FastStyleHeadingLevelV35 = 1
        Exit Function
    End If

    If normalizedName = LCase$(StyleH2Name()) Or _
       normalizedName = "heading2" Or _
       normalizedName = LCase$(U("6807 9898") & "2") Or _
       normalizedName = LCase$(U("4E8C 7EA7 6807 9898")) Then

        FastStyleHeadingLevelV35 = 2
        Exit Function
    End If

    If normalizedName = LCase$(StyleH3Name()) Or _
       normalizedName = "heading3" Or _
       normalizedName = LCase$(U("6807 9898") & "3") Or _
       normalizedName = LCase$(U("4E09 7EA7 6807 9898")) Then

        FastStyleHeadingLevelV35 = 3
        Exit Function
    End If

    If normalizedName = LCase$(StyleH4Name()) Or _
       normalizedName = "heading4" Or _
       normalizedName = LCase$(U("6807 9898") & "4") Or _
       normalizedName = LCase$(U("56DB 7EA7 6807 9898")) Then

        FastStyleHeadingLevelV35 = 4
        Exit Function
    End If

    FastStyleHeadingLevelV35 = _
        LegacyChapterStyleLevelV35(normalizedName)

End Function


Private Function LegacyChapterStyleLevelV35( _
                    ByVal normalizedStyleName As String) As Integer

    Dim coreName As String
    Dim i As Long
    Dim ch As String
    Dim groupCount As Integer
    Dim digitSeen As Boolean

    ' Only recognize style names ending with the Chinese character "chapter".
    If Right$(normalizedStyleName, 1) <> U("7AE0") Then Exit Function

    coreName = Left$(normalizedStyleName, Len(normalizedStyleName) - 1)

    If Len(coreName) = 0 Then Exit Function

    groupCount = 1

    For i = 1 To Len(coreName)

        ch = Mid$(coreName, i, 1)

        If ch >= "0" And ch <= "9" Then
            digitSeen = True
        ElseIf ch = "." Then
            If Not digitSeen Then Exit Function
            groupCount = groupCount + 1
            digitSeen = False

            If groupCount > 4 Then Exit Function
        Else
            Exit Function
        End If
    Next i

    If Not digitSeen Then Exit Function

    LegacyChapterStyleLevelV35 = groupCount

End Function

Private Function HeadingKindStrictV35( _
                    ByVal styleName As String, _
                    ByVal textValue As String) As Integer

    Dim styleLevel As Integer
    Dim typedLevel As Integer
    Dim prefixLength As Long
    Dim anyPrefixLength As Long
    Dim titleText As String

    If Len(textValue) = 0 Then Exit Function

    styleLevel = FastStyleHeadingLevelV35(styleName)

    ' ------------------------------------------------------------
    ' Existing heading style is only a clue, never absolute proof.
    ' This is important for documents damaged by earlier macros.
    ' ------------------------------------------------------------
    If styleLevel >= 1 And styleLevel <= 4 Then

        titleText = textValue
        anyPrefixLength = LeadingHeadingPrefixLengthV35(textValue)

        If anyPrefixLength > 0 Then
            titleText = Mid$(textValue, anyPrefixLength + 1)
            titleText = TrimUnicodeSpacesV35(titleText)
        End If

        If PlausibleHeadingAtLevelV35(titleText, styleLevel) Then
            HeadingKindStrictV35 = styleLevel
            Exit Function
        End If
    End If

    ' ------------------------------------------------------------
    ' For paragraphs without a trustworthy heading style, infer the
    ' level only from a strict numeric prefix.
    ' ------------------------------------------------------------
    If StrictHeadingPrefixInfoV35( _
            textValue, typedLevel, prefixLength) Then

        titleText = Mid$(textValue, prefixLength + 1)
        titleText = TrimUnicodeSpacesV35(titleText)

        If PlausibleHeadingAtLevelV35(titleText, typedLevel) Then
            HeadingKindStrictV35 = typedLevel
        End If
    End If

    ' No OutlineLevel fallback.
    ' No style OutlineLevel fallback.
    ' No ListFormat fallback.

End Function

Private Function PlausibleHeadingTextV35( _
                    ByVal textValue As String) As Boolean

    Dim cleanText As String

    cleanText = TrimUnicodeSpacesV35(textValue)

    If Len(cleanText) = 0 Then Exit Function
    If Len(cleanText) > 120 Then Exit Function

    If InStr(cleanText, U("3002")) > 0 Then Exit Function
    If InStr(cleanText, U("FF01")) > 0 Then Exit Function
    If InStr(cleanText, U("FF1F")) > 0 Then Exit Function

    PlausibleHeadingTextV35 = True

End Function


Private Function PlausibleHeadingAtLevelV35( _
                    ByVal textValue As String, _
                    ByVal headingLevel As Integer) As Boolean

    Dim cleanText As String
    Dim maxLength As Long

    cleanText = TrimUnicodeSpacesV35(textValue)

    If Len(cleanText) = 0 Then Exit Function

    Select Case headingLevel
        Case 1
            ' Level-1 heading detection remains conservative because
            ' old documents often contain body text wrongly styled as H1.
            maxLength = 50
        Case 2
            maxLength = 80
        Case 3
            maxLength = 100
        Case Else
            maxLength = 120
    End Select

    If Len(cleanText) > maxLength Then Exit Function

    ' Strong body-sentence punctuation.
    If InStr(cleanText, U("3002")) > 0 Then Exit Function
    If InStr(cleanText, U("FF01")) > 0 Then Exit Function
    If InStr(cleanText, U("FF1F")) > 0 Then Exit Function
    If InStr(cleanText, U("FF1B")) > 0 Then Exit Function

    PlausibleHeadingAtLevelV35 = True

End Function

Private Function LeadingHeadingPrefixLengthV35( _
                    ByVal textValue As String) As Long

    Dim detectedLevel As Integer
    Dim strictLength As Long

    Dim i As Long
    Dim n As Long
    Dim digitCount As Integer
    Dim spaceCount As Integer
    Dim ch As String

    ' First use the normal strict parser.
    If StrictHeadingPrefixInfoV35( _
            textValue, detectedLevel, strictLength) Then

        LeadingHeadingPrefixLengthV35 = strictLength
        Exit Function
    End If

    ' Fallback used ONLY on already-confirmed headings:
    ' remove a bare integer followed by at least two spaces.
    '
    ' This cleans old text such as:
    '   1  Overview
    ' after an automatic "1.1  " has also been applied.
    n = Len(textValue)
    i = 1

    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If ch >= "0" And ch <= "9" Then
            digitCount = digitCount + 1

            If digitCount > 3 Then Exit Function

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If digitCount = 0 Then Exit Function

    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            spaceCount = spaceCount + 1
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If spaceCount >= 2 And i <= n Then
        LeadingHeadingPrefixLengthV35 = i - 1
    End If

End Function

Private Function IsHeadingNumberSeparatorV35( _
                    ByVal ch As String) As Boolean

    Dim codeValue As Long

    If Len(ch) = 0 Then Exit Function

    codeValue = AscW(ch)

    If ch = "." Then
        IsHeadingNumberSeparatorV35 = True
        Exit Function
    End If

    ' Middle dot, Chinese full stop, ideographic comma.
    If codeValue = 183 Or _
       codeValue = 12290 Or _
       codeValue = 12289 Then

        IsHeadingNumberSeparatorV35 = True
    End If

End Function

Private Function IsTerminalHeadingSeparatorV35( _
                    ByVal ch As String) As Boolean

    Dim codeValue As Long

    If Len(ch) = 0 Then Exit Function

    codeValue = AscW(ch)

    If ch = "." Or ch = ":" Or ch = ")" Or ch = "-" Then
        IsTerminalHeadingSeparatorV35 = True
        Exit Function
    End If

    If codeValue = 183 Or _
       codeValue = 12290 Or _
       codeValue = 12289 Or _
       codeValue = 65306 Or _
       codeValue = 65289 Then

        IsTerminalHeadingSeparatorV35 = True
    End If

End Function

Private Function StrictHeadingPrefixInfoV35( _
                    ByVal textValue As String, _
                    ByRef headingLevel As Integer, _
                    ByRef prefixLength As Long) As Boolean

    Dim i As Long
    Dim n As Long
    Dim groupCount As Integer
    Dim digitCount As Integer
    Dim spacesAfterDigits As Integer
    Dim spacesAfterSeparator As Integer
    Dim ch As String
    Dim hadTerminalSeparator As Boolean

    n = Len(textValue)
    i = 1

    ' Include leading spaces in the removable prefix.
    Do While i <= n
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    Do
        digitCount = 0

        Do While i <= n
            ch = Mid$(textValue, i, 1)

            If ch >= "0" And ch <= "9" Then
                digitCount = digitCount + 1

                ' Avoid years/IDs such as 2024.
                If digitCount > 3 Then Exit Function

                i = i + 1
            Else
                Exit Do
            End If
        Loop

        If digitCount = 0 Then Exit Function

        groupCount = groupCount + 1
        If groupCount > 4 Then Exit Function

        spacesAfterDigits = 0

        Do While i <= n
            ch = Mid$(textValue, i, 1)

            If IsHeadingSpaceV35(ch) Then
                spacesAfterDigits = spacesAfterDigits + 1
                i = i + 1
            Else
                Exit Do
            End If
        Loop

        If i > n Then Exit Function

        ch = Mid$(textValue, i, 1)

        If IsHeadingNumberSeparatorV35(ch) Then
            i = i + 1
            spacesAfterSeparator = 0

            Do While i <= n
                ch = Mid$(textValue, i, 1)

                If IsHeadingSpaceV35(ch) Then
                    spacesAfterSeparator = spacesAfterSeparator + 1
                    i = i + 1
                Else
                    Exit Do
                End If
            Loop

            If i > n Then Exit Function

            ch = Mid$(textValue, i, 1)

            If ch >= "0" And ch <= "9" Then
                ' Separator joins another numeric group.
            Else
                ' Separator is terminal punctuation before the title.
                hadTerminalSeparator = True
                Exit Do
            End If
        Else
            ' No separator: spaces after the last number terminate prefix.
            If spacesAfterDigits = 0 Then Exit Function

            ' A bare level-1 number is accepted only with two spaces.
            ' This avoids treating "20 MW..." as a chapter heading.
            If groupCount = 1 And spacesAfterDigits < 2 Then
                Exit Function
            End If

            Exit Do
        End If
    Loop

    If groupCount < 1 Or groupCount > 4 Then Exit Function
    If i > n Then Exit Function

    headingLevel = groupCount
    prefixLength = i - 1
    StrictHeadingPrefixInfoV35 = True

End Function

Private Function TrimLeadingSpacesOnlyV35( _
                    ByVal textValue As String) As String

    Dim i As Long
    Dim ch As String

    i = 1

    Do While i <= Len(textValue)
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    TrimLeadingSpacesOnlyV35 = Mid$(textValue, i)

End Function

Private Function IsHeadingSpaceV35(ByVal ch As String) As Boolean

    Dim codeValue As Long

    If Len(ch) = 0 Then Exit Function

    If ch = " " Or ch = vbTab Then
        IsHeadingSpaceV35 = True
        Exit Function
    End If

    codeValue = AscW(ch)

    If codeValue = 160 Or codeValue = 12288 Then
        IsHeadingSpaceV35 = True
    End If

End Function

Private Function IsGenericCaptionStyleV35( _
                    ByVal styleName As String) As Boolean

    Dim normalizedName As String

    normalizedName = LCase$(Replace(Trim$(styleName), " ", ""))

    IsGenericCaptionStyleV35 = _
        (normalizedName = LCase$(StyleCaptionName()) Or _
         normalizedName = "caption")

End Function

Private Function CaptionKindStrictV35( _
                    ByVal styleName As String, _
                    ByVal textValue As String) As Integer

    Dim normalizedName As String
    Dim candidateText As String
    Dim prefixLength As Long

    normalizedName = LCase$(Replace(Trim$(styleName), " ", ""))

    If normalizedName = LCase$(StyleFigureCaptionName()) Then
        CaptionKindStrictV35 = 101
        Exit Function
    End If

    If normalizedName = LCase$(StyleTableCaptionName()) Then
        CaptionKindStrictV35 = 102
        Exit Function
    End If

    candidateText = TrimUnicodeSpacesV35(textValue)

    prefixLength = _
        TypedCaptionExtraPrefixLengthSafeV35(candidateText)

    If prefixLength > 0 Then
        candidateText = Mid$(candidateText, prefixLength + 1)
        candidateText = TrimUnicodeSpacesV35(candidateText)
    End If

    If FigureCaptionTextStrictV35(candidateText, styleName) Then
        CaptionKindStrictV35 = 101
    ElseIf TableCaptionTextStrictV35(candidateText, styleName) Then
        CaptionKindStrictV35 = 102
    End If

End Function

Private Function FigureCaptionTextStrictV35( _
                    ByVal textValue As String, _
                    ByVal styleName As String) As Boolean

    Dim restText As String
    Dim genericCaption As Boolean
    Dim lowerText As String

    genericCaption = IsGenericCaptionStyleV35(styleName)
    lowerText = LCase$(textValue)

    If Left$(lowerText, 6) = "figure" Or _
       Left$(lowerText, 3) = "fig" Then

        FigureCaptionTextStrictV35 = True
        Exit Function
    End If

    If Left$(textValue, 1) <> U("56FE") Then Exit Function

    restText = Mid$(textValue, 2)
    restText = TrimLeadingSpacesOnlyV35(restText)

    If genericCaption Then
        FigureCaptionTextStrictV35 = True
    ElseIf Len(restText) > 0 Then
        If Left$(restText, 1) >= "0" And _
           Left$(restText, 1) <= "9" Then

            FigureCaptionTextStrictV35 = True
        End If
    End If

End Function

Private Function TableCaptionTextStrictV35( _
                    ByVal textValue As String, _
                    ByVal styleName As String) As Boolean

    Dim restText As String
    Dim genericCaption As Boolean
    Dim lowerText As String

    genericCaption = IsGenericCaptionStyleV35(styleName)
    lowerText = LCase$(textValue)

    If Left$(lowerText, 5) = "table" Then
        TableCaptionTextStrictV35 = True
        Exit Function
    End If

    If Left$(textValue, 1) <> U("8868") Then Exit Function

    restText = Mid$(textValue, 2)
    restText = TrimLeadingSpacesOnlyV35(restText)

    If genericCaption Then
        TableCaptionTextStrictV35 = True
    ElseIf Len(restText) > 0 Then
        If Left$(restText, 1) >= "0" And _
           Left$(restText, 1) <= "9" Then

            TableCaptionTextStrictV35 = True
        End If
    End If

End Function

Private Function TypedCaptionExtraPrefixLengthSafeV35( _
                    ByVal textValue As String) As Long

    Dim i As Long
    Dim textLength As Long
    Dim digitStart As Long
    Dim ch As String
    Dim candidateAfter As String

    textLength = Len(textValue)
    i = 1

    Do While i <= textLength
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Or _
           ch = "'" Or ch = Chr$(34) Then

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    digitStart = i

    Do While i <= textLength
        ch = Mid$(textValue, i, 1)

        If ch >= "0" And ch <= "9" Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If i = digitStart Then Exit Function
    If i > textLength Then Exit Function

    ch = Mid$(textValue, i, 1)

    If ch = "." Or ch = ")" Or ch = ":" Or _
       AscW(ch) = 12290 Or AscW(ch) = 65289 Or _
       AscW(ch) = 12289 Or AscW(ch) = 65306 Then

        i = i + 1
    Else
        Exit Function
    End If

    Do While i <= textLength
        ch = Mid$(textValue, i, 1)

        If IsHeadingSpaceV35(ch) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    candidateAfter = Mid$(textValue, i)
    candidateAfter = TrimUnicodeSpacesV35(candidateAfter)

    If Left$(candidateAfter, 1) = U("56FE") Or _
       Left$(candidateAfter, 1) = U("8868") Or _
       LCase$(Left$(candidateAfter, 3)) = "fig" Or _
       LCase$(Left$(candidateAfter, 5)) = "table" Then

        TypedCaptionExtraPrefixLengthSafeV35 = i - 1
    End If

End Function

Private Sub FormatBodyRunsLockedV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByRef counts() As Long, _
                    ByVal runCount As Long, _
                    ByVal styBody As Style, _
                    ByVal stepName As String)

    Dim i As Long
    Dim targetRange As Range

    For i = 1 To runCount

        Set targetRange = doc.Range(starts(i), ends(i))

        On Error Resume Next

        targetRange.ParagraphFormat.Reset
        targetRange.Font.Reset
        targetRange.Style = styBody.NameLocal

        ' Do not merely rely on the style definition.
        ' Force the actual paragraphs back to Body outline level.
        With targetRange.ParagraphFormat
            .OutlineLevel = wdOutlineLevelBodyText
            .Alignment = wdAlignParagraphJustify
            .SpaceBefore = 0
            .SpaceAfter = 0
            .LineSpacingRule = wdLineSpaceExactly
            .LineSpacing = 24
            .LeftIndent = 0
            .RightIndent = 0
            .FirstLineIndent = 0
            .CharacterUnitFirstLineIndent = 2
            .DisableLineHeightGrid = True
        End With

        On Error GoTo 0

        If i Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(i, "#,##0") & _
                " / " & Format$(runCount, "#,##0")
            DoEvents
        End If

    Next i

End Sub

Private Sub ProcessSpecialParagraphsSafeV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByVal specialCount As Long, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef headingCount As Long, _
                    ByRef headingErrorCount As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByRef figureCount As Long, _
                    ByRef tableCaptionCount As Long, _
                    ByRef captionErrorCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim pointRange As Range
    Dim para As Paragraph
    Dim specialKind As Integer

    For i = specialCount To 1 Step -1

        specialKind = kinds(i)

        On Error GoTo SpecialError

        Set pointRange = doc.Range(starts(i), starts(i))
        Set para = pointRange.Paragraphs(1)

        If specialKind >= 1 And specialKind <= 4 Then

            If ApplyTrueHeadingStyleV35( _
                    para, specialKind, _
                    styH1, styH2, styH3, styH4) Then

                headingCount = headingCount + 1

                If specialKind = 4 Then
                    level4Count = level4Count + 1
                End If
            Else
                headingErrorCount = headingErrorCount + 1

                If specialKind = 4 Then
                    level4ErrorCount = level4ErrorCount + 1
                End If
            End If

        ElseIf specialKind = 101 Then

            CleanCaptionAndApplyStyleV35 _
                para, 1, styFigureCaption

            figureCount = figureCount + 1

        ElseIf specialKind = 102 Then

            CleanCaptionAndApplyStyleV35 _
                para, 2, styTableCaption

            tableCaptionCount = tableCaptionCount + 1

        ElseIf specialKind = 105 Then

            para.Range.ListFormat.RemoveNumbers _
                NumberType:=wdNumberParagraph

            para.Range.ParagraphFormat.Reset
            para.Range.Font.Reset
            para.Range.Style = styCaption.NameLocal
        End If

ContinueSpecial:
        On Error GoTo 0

        If i Mod 250 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(specialCount - i + 1, "#,##0") & _
                " / " & Format$(specialCount, "#,##0")
            DoEvents
        End If

    Next i

    Exit Sub

SpecialError:
    If specialKind = 101 Or specialKind = 102 Then
        captionErrorCount = captionErrorCount + 1
    Else
        headingErrorCount = headingErrorCount + 1
    End If

    Err.Clear
    Resume ContinueSpecial

End Sub

Private Function ApplyTrueHeadingStyleV35( _
                    ByVal para As Paragraph, _
                    ByVal headingLevel As Integer, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style) As Boolean

    Dim targetStyle As Style

    On Error GoTo HeadingError

    Select Case headingLevel
        Case 1
            Set targetStyle = styH1
        Case 2
            Set targetStyle = styH2
        Case 3
            Set targetStyle = styH3
        Case 4
            Set targetStyle = styH4
        Case Else
            Exit Function
    End Select

    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo HeadingError

    StripAnyOldHeadingPrefixV35 para

    para.Range.ParagraphFormat.Reset
    para.Range.Font.Reset
    para.Range.Style = targetStyle.NameLocal

    ApplyTrueHeadingStyleV35 = True
    Exit Function

HeadingError:
    ApplyTrueHeadingStyleV35 = False

End Function


Private Sub StripAnyOldHeadingPrefixV35( _
                    ByVal para As Paragraph)

    Dim contentRange As Range
    Dim textValue As String
    Dim removeLength As Long
    Dim passNumber As Integer

    ' Up to three passes handles duplicated legacy text such as:
    '   1.1  1  Overview
    ' or:
    '   2.2  2.2  Wind resource
    For passNumber = 1 To 3

        Set contentRange = para.Range.Duplicate

        Do While contentRange.End > contentRange.Start
            If Right$(contentRange.Text, 1) = Chr$(13) Or _
               Right$(contentRange.Text, 1) = Chr$(7) Then

                contentRange.MoveEnd wdCharacter, -1
            Else
                Exit Do
            End If
        Loop

        textValue = contentRange.Text
        removeLength = LeadingHeadingPrefixLengthV35(textValue)

        If removeLength <= 0 Then Exit For

        contentRange.End = contentRange.Start + removeLength
        contentRange.Delete
    Next passNumber

End Sub

Private Sub StripStrictTypedHeadingPrefixV35( _
                    ByVal para As Paragraph, _
                    ByVal expectedLevel As Integer)

    Dim contentRange As Range
    Dim textValue As String
    Dim detectedLevel As Integer
    Dim prefixLength As Long

    Set contentRange = para.Range.Duplicate

    Do While contentRange.End > contentRange.Start
        If Right$(contentRange.Text, 1) = Chr$(13) Or _
           Right$(contentRange.Text, 1) = Chr$(7) Then

            contentRange.MoveEnd wdCharacter, -1
        Else
            Exit Do
        End If
    Loop

    textValue = contentRange.Text

    If StrictHeadingPrefixInfoV35( _
            textValue, detectedLevel, prefixLength) Then

        If detectedLevel = expectedLevel And prefixLength > 0 Then
            contentRange.End = contentRange.Start + prefixLength
            contentRange.Delete
        End If
    End If

End Sub

Private Sub CleanCaptionAndApplyStyleV35( _
                    ByVal para As Paragraph, _
                    ByVal captionType As Integer, _
                    ByVal targetStyle As Style)

    Dim contentRange As Range
    Dim textValue As String
    Dim removeLength As Long

    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo 0

    Set contentRange = para.Range.Duplicate

    Do While contentRange.End > contentRange.Start
        If Right$(contentRange.Text, 1) = Chr$(13) Or _
           Right$(contentRange.Text, 1) = Chr$(7) Then

            contentRange.MoveEnd wdCharacter, -1
        Else
            Exit Do
        End If
    Loop

    textValue = contentRange.Text
    removeLength = TypedCaptionExtraPrefixLengthSafeV35(textValue)

    If removeLength > 0 Then
        contentRange.End = contentRange.Start + removeLength
        contentRange.Delete
    End If

    para.Range.ParagraphFormat.Reset
    para.Range.Font.Reset
    para.Range.Style = targetStyle.NameLocal

    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo 0

    ApplyCaptionDirectFormatV35 para.Range, captionType

End Sub

' ============================================================
' V35 ULTRA-FAST ENGINE
' ============================================================

Private Function BuildFastStructureMapV35( _
                    ByVal doc As Document, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef bodyRunStarts() As Long, _
                    ByRef bodyRunEnds() As Long, _
                    ByRef bodyRunParagraphCounts() As Long, _
                    ByRef bodyRunCount As Long, _
                    ByRef specialStarts() As Long, _
                    ByRef specialKinds() As Integer, _
                    ByRef bodyParagraphCount As Long, _
                    ByRef headingLocatedCount As Long, _
                    ByRef figureLocatedCount As Long, _
                    ByRef tableCaptionLocatedCount As Long, _
                    ByRef genericCaptionCount As Long, _
                    ByVal stepName As String) As Long

    Const RUN_GROW_BY As Long = 256
    Const SPECIAL_GROW_BY As Long = 512
    Const PROGRESS_EVERY As Long = 1000

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim sty As Style
    Dim styleName As String
    Dim textValue As String
    Dim styleKind As Integer
    Dim specialKind As Integer
    Dim specialCount As Long
    Dim scannedCount As Long

    Dim styleCache As Object
    Dim pictureParagraphs As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim runCapacity As Long
    Dim specialCapacity As Long

    Dim runOpen As Boolean
    Dim runStart As Long
    Dim runEnd As Long
    Dim runParagraphs As Long

    runCapacity = RUN_GROW_BY
    specialCapacity = SPECIAL_GROW_BY

    ReDim bodyRunStarts(1 To runCapacity)
    ReDim bodyRunEnds(1 To runCapacity)
    ReDim bodyRunParagraphCounts(1 To runCapacity)

    ReDim specialStarts(1 To specialCapacity)
    ReDim specialKinds(1 To specialCapacity)

    Set styleCache = CreateObject("Scripting.Dictionary")
    styleCache.CompareMode = vbTextCompare

    Set pictureParagraphs = CreateObject("Scripting.Dictionary")
    BuildPictureParagraphMapUltraV35 doc, pictureParagraphs

    BuildTableOfContentsBoundaries _
        doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' Important: this scan does not modify the document.
    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1
        Set paraRange = para.Range.Duplicate

        If paraRange.Information(wdWithInTable) Then
            CloseBodyRunV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY
        ElseIf IsPositionInsideTocSequentialV35( _
                paraRange.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            CloseBodyRunV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY
        ElseIf pictureParagraphs.Exists(CStr(paraRange.Start)) Then
            CloseBodyRunV35 _
                runOpen, runStart, runEnd, runParagraphs, _
                bodyRunStarts, bodyRunEnds, _
                bodyRunParagraphCounts, bodyRunCount, _
                runCapacity, RUN_GROW_BY
        Else
            Set sty = Nothing
            styleName = ""

            On Error Resume Next
            Set sty = paraRange.Style
            If Not sty Is Nothing Then styleName = sty.NameLocal
            On Error GoTo 0

            textValue = CleanParagraphTextV35(paraRange.Text)

            specialKind = DetectCaptionKindV35( _
                styleName, textValue, _
                styCaption.NameLocal, _
                styFigureCaption.NameLocal, _
                styTableCaption.NameLocal)

            If specialKind = 101 Or specialKind = 102 Then
                CloseBodyRunV35 _
                    runOpen, runStart, runEnd, runParagraphs, _
                    bodyRunStarts, bodyRunEnds, _
                    bodyRunParagraphCounts, bodyRunCount, _
                    runCapacity, RUN_GROW_BY

                specialCount = specialCount + 1
                AddSpecialRecordV35 _
                    specialCount, paraRange.Start, specialKind, _
                    specialStarts, specialKinds, _
                    specialCapacity, SPECIAL_GROW_BY

                If specialKind = 101 Then
                    figureLocatedCount = figureLocatedCount + 1
                Else
                    tableCaptionLocatedCount = _
                        tableCaptionLocatedCount + 1
                End If
            Else
                styleKind = CachedStyleKindV35( _
                    doc, sty, styleName, styleCache)

                If styleKind = 5 Then
                    CloseBodyRunV35 _
                        runOpen, runStart, runEnd, runParagraphs, _
                        bodyRunStarts, bodyRunEnds, _
                        bodyRunParagraphCounts, bodyRunCount, _
                        runCapacity, RUN_GROW_BY

                    genericCaptionCount = genericCaptionCount + 1
                Else
                    specialKind = DetectHeadingKindV35( _
                        para, textValue, styleKind)

                    If specialKind >= 1 And specialKind <= 4 Then
                        CloseBodyRunV35 _
                            runOpen, runStart, runEnd, runParagraphs, _
                            bodyRunStarts, bodyRunEnds, _
                            bodyRunParagraphCounts, bodyRunCount, _
                            runCapacity, RUN_GROW_BY

                        specialCount = specialCount + 1
                        AddSpecialRecordV35 _
                            specialCount, paraRange.Start, specialKind, _
                            specialStarts, specialKinds, _
                            specialCapacity, SPECIAL_GROW_BY

                        headingLocatedCount = headingLocatedCount + 1
                    Else
                        If Not runOpen Then
                            runOpen = True
                            runStart = paraRange.Start
                            runParagraphs = 0
                        End If

                        runEnd = paraRange.End
                        runParagraphs = runParagraphs + 1
                        bodyParagraphCount = bodyParagraphCount + 1
                    End If
                End If
            End If
        End If

        If scannedCount Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; headings " & _
                Format$(headingLocatedCount, "#,##0") & _
                "; captions " & _
                Format$(figureLocatedCount + _
                        tableCaptionLocatedCount, "#,##0")
            DoEvents
        End If
    Next para

    CloseBodyRunV35 _
        runOpen, runStart, runEnd, runParagraphs, _
        bodyRunStarts, bodyRunEnds, bodyRunParagraphCounts, _
        bodyRunCount, runCapacity, RUN_GROW_BY

    If bodyRunCount > 0 Then
        ReDim Preserve bodyRunStarts(1 To bodyRunCount)
        ReDim Preserve bodyRunEnds(1 To bodyRunCount)
        ReDim Preserve bodyRunParagraphCounts(1 To bodyRunCount)
    End If

    If specialCount > 0 Then
        ReDim Preserve specialStarts(1 To specialCount)
        ReDim Preserve specialKinds(1 To specialCount)
    End If

    BuildFastStructureMapV35 = specialCount

End Function

Private Sub BuildPictureParagraphMapUltraV35( _
                    ByVal doc As Document, _
                    ByVal paragraphMap As Object)

    Dim mainRange As Range
    Dim ils As InlineShape
    Dim shp As Shape
    Dim paraStart As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each ils In mainRange.InlineShapes
        On Error Resume Next
        paraStart = ils.Range.Paragraphs(1).Range.Start
        paragraphMap(CStr(paraStart)) = True
        On Error GoTo 0
    Next ils

    For Each shp In doc.Shapes
        If IsPictureShapeV10(shp) Then
            On Error Resume Next
            paraStart = shp.Anchor.Paragraphs(1).Range.Start
            paragraphMap(CStr(paraStart)) = True
            On Error GoTo 0
        End If
    Next shp

End Sub

Private Sub CloseBodyRunV35( _
                    ByRef runOpen As Boolean, _
                    ByRef runStart As Long, _
                    ByRef runEnd As Long, _
                    ByRef runParagraphs As Long, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByRef counts() As Long, _
                    ByRef runCount As Long, _
                    ByRef capacity As Long, _
                    ByVal growBy As Long)

    If Not runOpen Then Exit Sub

    If runEnd > runStart Then
        runCount = runCount + 1

        If runCount > capacity Then
            capacity = capacity + growBy
            ReDim Preserve starts(1 To capacity)
            ReDim Preserve ends(1 To capacity)
            ReDim Preserve counts(1 To capacity)
        End If

        starts(runCount) = runStart
        ends(runCount) = runEnd
        counts(runCount) = runParagraphs
    End If

    runOpen = False
    runStart = 0
    runEnd = 0
    runParagraphs = 0

End Sub

Private Sub AddSpecialRecordV35( _
                    ByVal recordIndex As Long, _
                    ByVal startPosition As Long, _
                    ByVal specialKind As Integer, _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByRef capacity As Long, _
                    ByVal growBy As Long)

    If recordIndex > capacity Then
        capacity = capacity + growBy
        ReDim Preserve starts(1 To capacity)
        ReDim Preserve kinds(1 To capacity)
    End If

    starts(recordIndex) = startPosition
    kinds(recordIndex) = specialKind

End Sub



Private Function CachedStyleKindV35( _
                    ByVal doc As Document, _
                    ByVal sty As Style, _
                    ByVal styleName As String, _
                    ByVal styleCache As Object) As Integer

    If sty Is Nothing Then Exit Function

    If styleCache.Exists(styleName) Then
        CachedStyleKindV35 = CInt(styleCache(styleName))
    Else
        CachedStyleKindV35 = DetectStyleKindFast(doc, sty)
        styleCache.Add styleName, CachedStyleKindV35
    End If

End Function

Private Function DetectCaptionKindV35( _
                    ByVal styleName As String, _
                    ByVal textValue As String, _
                    ByVal genericCaptionName As String, _
                    ByVal figureCaptionName As String, _
                    ByVal tableCaptionName As String) As Integer

    Dim captionType As Integer

    captionType = CaptionTypeFromTextV35(textValue)

    If captionType = 1 Then
        DetectCaptionKindV35 = 101
        Exit Function
    ElseIf captionType = 2 Then
        DetectCaptionKindV35 = 102
        Exit Function
    End If

    If StrComp(styleName, figureCaptionName, vbTextCompare) = 0 Then
        DetectCaptionKindV35 = 101
    ElseIf StrComp(styleName, tableCaptionName, vbTextCompare) = 0 Then
        DetectCaptionKindV35 = 102
    ElseIf StrComp(styleName, genericCaptionName, vbTextCompare) = 0 Then
        DetectCaptionKindV35 = 105
    End If

End Function

Private Function CaptionTypeFromTextV35( _
                    ByVal textValue As String) As Integer

    Dim directText As String
    Dim prefixLength As Long

    directText = TrimCaptionLeadingSpacesV35(textValue)

    If StartsWithCaptionLabelV35(directText, 1) Then
        CaptionTypeFromTextV35 = 1
        Exit Function
    End If

    If StartsWithCaptionLabelV35(directText, 2) Then
        CaptionTypeFromTextV35 = 2
        Exit Function
    End If

    prefixLength = TypedCaptionListPrefixLengthFastV35(directText)

    If prefixLength > 0 Then
        directText = Mid$(directText, prefixLength + 1)

        If StartsWithCaptionLabelV35(directText, 1) Then
            CaptionTypeFromTextV35 = 1
        ElseIf StartsWithCaptionLabelV35(directText, 2) Then
            CaptionTypeFromTextV35 = 2
        End If
    End If

End Function

Private Function TrimCaptionLeadingSpacesV35( _
                    ByVal textValue As String) As String

    Dim i As Long
    Dim ch As String

    i = 1

    Do While i <= Len(textValue)
        ch = Mid$(textValue, i, 1)

        If ch = " " Or ch = vbTab Or _
           AscW(ch) = 160 Or AscW(ch) = 12288 Then

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    TrimCaptionLeadingSpacesV35 = Mid$(textValue, i)

End Function

Private Function TypedCaptionListPrefixLengthFastV35( _
                    ByVal textValue As String) As Long

    Dim i As Long
    Dim lengthValue As Long
    Dim ch As String
    Dim numberStart As Long
    Dim afterNumber As Long
    Dim remainingText As String

    lengthValue = Len(textValue)
    i = 1

    ' Skip harmless bullets/quotes that sometimes precede a pasted list.
    Do While i <= lengthValue
        ch = Mid$(textValue, i, 1)

        If ch = "'" Or ch = Chr$(34) Or _
           AscW(ch) = 183 Or AscW(ch) = 8226 Or _
           AscW(ch) = 8216 Or AscW(ch) = 8217 Or _
           AscW(ch) = 8220 Or AscW(ch) = 8221 Or _
           ch = " " Or ch = vbTab Or _
           AscW(ch) = 160 Or AscW(ch) = 12288 Then

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    numberStart = i

    Do While i <= lengthValue
        ch = Mid$(textValue, i, 1)

        If ch >= "0" And ch <= "9" Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If i = numberStart Then Exit Function
    If i > lengthValue Then Exit Function

    ch = Mid$(textValue, i, 1)

    If Not IsListSeparatorV35(ch) Then Exit Function

    i = i + 1

    Do While i <= lengthValue
        ch = Mid$(textValue, i, 1)

        If ch = " " Or ch = vbTab Or _
           AscW(ch) = 160 Or AscW(ch) = 12288 Then

            i = i + 1
        Else
            Exit Do
        End If
    Loop

    afterNumber = i
    remainingText = Mid$(textValue, afterNumber)

    If StartsWithCaptionLabelV35(remainingText, 1) Or _
       StartsWithCaptionLabelV35(remainingText, 2) Then

        TypedCaptionListPrefixLengthFastV35 = afterNumber - 1
    End If

End Function

Private Function IsListSeparatorV35( _
                    ByVal ch As String) As Boolean

    Dim codeValue As Long

    If Len(ch) = 0 Then Exit Function

    codeValue = AscW(ch)

    Select Case ch
        Case ".", ")", ":", ","
            IsListSeparatorV35 = True
            Exit Function
    End Select

    Select Case codeValue
        Case 12290, 65289, 12289, 65306, 12289
            IsListSeparatorV35 = True
    End Select

End Function

Private Function DetectHeadingKindV35( _
                    ByVal para As Paragraph, _
                    ByVal textValue As String, _
                    ByVal styleKind As Integer) As Integer

    Dim typedLevel As Integer
    Dim outlineLevel As WdOutlineLevel

    If styleKind >= 1 And styleKind <= 4 Then
        DetectHeadingKindV35 = styleKind
        Exit Function
    End If

    ' Long paragraphs are overwhelmingly body text. Avoid expensive
    ' paragraph outline queries for them.
    If Len(textValue) = 0 Or Len(textValue) > 160 Then Exit Function

    typedLevel = NumericHeadingPrefixLevelV35(textValue)

    If typedLevel >= 1 And typedLevel <= 4 Then
        DetectHeadingKindV35 = typedLevel
        Exit Function
    End If

    On Error Resume Next
    outlineLevel = para.OutlineLevel
    On Error GoTo 0

    Select Case outlineLevel
        Case wdOutlineLevel1
            DetectHeadingKindV35 = 1
        Case wdOutlineLevel2
            DetectHeadingKindV35 = 2
        Case wdOutlineLevel3
            DetectHeadingKindV35 = 3
        Case wdOutlineLevel4
            DetectHeadingKindV35 = 4
    End Select

End Function

Private Function NumericHeadingPrefixLevelV35( _
                    ByVal textValue As String) As Integer

    Dim i As Long
    Dim lengthValue As Long
    Dim groups As Integer
    Dim digitCount As Long
    Dim ch As String
    Dim nextCh As String

    textValue = TrimCaptionLeadingSpacesV35(textValue)
    lengthValue = Len(textValue)

    If lengthValue = 0 Then Exit Function

    i = 1

    Do
        digitCount = 0

        Do While i <= lengthValue
            ch = Mid$(textValue, i, 1)

            If ch >= "0" And ch <= "9" Then
                digitCount = digitCount + 1
                i = i + 1
            Else
                Exit Do
            End If
        Loop

        If digitCount = 0 Then Exit Function

        groups = groups + 1
        If groups > 4 Then Exit Function

        If i > lengthValue Then Exit Do

        ch = Mid$(textValue, i, 1)

        If ch = "." Then
            If i < lengthValue Then
                nextCh = Mid$(textValue, i + 1, 1)

                If nextCh >= "0" And nextCh <= "9" Then
                    i = i + 1
                Else
                    ' Terminal dot after a level-1 number.
                    i = i + 1
                    Exit Do
                End If
            Else
                Exit Do
            End If
        Else
            Exit Do
        End If
    Loop

    If groups < 1 Or groups > 4 Then Exit Function

    ' The numeric prefix must be followed by whitespace/punctuation or
    ' ordinary title text, not another digit.
    NumericHeadingPrefixLevelV35 = groups

End Function

Private Sub FormatBodyRunsV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef ends() As Long, _
                    ByRef counts() As Long, _
                    ByVal runCount As Long, _
                    ByVal styBody As Style, _
                    ByVal stepName As String)

    Dim i As Long
    Dim targetRange As Range

    For i = 1 To runCount

        Set targetRange = doc.Range(starts(i), ends(i))

        On Error Resume Next

        targetRange.Style = styBody.NameLocal

        If RESET_DIRECT_PARAGRAPH_FORMATTING Then
            targetRange.ParagraphFormat.Reset
            targetRange.Style = styBody.NameLocal
        End If

        If ENFORCE_FONT_NAME_AND_SIZE Then
            EnforceFontNameAndSize targetRange, 0
        End If

        On Error GoTo 0

        If i Mod 100 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(i, "#,##0") & _
                " / " & Format$(runCount, "#,##0")
            DoEvents
        End If
    Next i

End Sub

Private Sub ProcessSpecialParagraphsFastV35( _
                    ByVal doc As Document, _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByVal specialCount As Long, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef headingCount As Long, _
                    ByRef headingErrorCount As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByRef figureCount As Long, _
                    ByRef tableCaptionCount As Long, _
                    ByRef captionErrorCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim pointRange As Range
    Dim para As Paragraph
    Dim specialKind As Integer

    For i = specialCount To 1 Step -1

        specialKind = kinds(i)

        On Error GoTo SpecialError

        Set pointRange = doc.Range(starts(i), starts(i))
        Set para = pointRange.Paragraphs(1)

        If specialKind >= 1 And specialKind <= 4 Then
            If NormalizeLinkedHeadingV35( _
                    para, specialKind, _
                    styH1, styH2, styH3, styH4) Then

                headingCount = headingCount + 1

                If specialKind = 4 Then
                    level4Count = level4Count + 1
                End If
            Else
                headingErrorCount = headingErrorCount + 1

                If specialKind = 4 Then
                    level4ErrorCount = level4ErrorCount + 1
                End If
            End If
        ElseIf specialKind = 101 Then
            CleanAndFormatCaptionV35 _
                para, 1, styFigureCaption

            figureCount = figureCount + 1
        ElseIf specialKind = 102 Then
            CleanAndFormatCaptionV35 _
                para, 2, styTableCaption

            tableCaptionCount = tableCaptionCount + 1
        End If

ContinueSpecial:
        On Error GoTo 0

        If i Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(specialCount - i + 1, "#,##0") & _
                " / " & Format$(specialCount, "#,##0")
            DoEvents
        End If
    Next i

    Exit Sub

SpecialError:
    If specialKind = 101 Or specialKind = 102 Then
        captionErrorCount = captionErrorCount + 1
    Else
        headingErrorCount = headingErrorCount + 1
    End If

    Err.Clear
    Resume ContinueSpecial

End Sub

Private Function NormalizeLinkedHeadingV35( _
                    ByVal para As Paragraph, _
                    ByVal headingLevel As Integer, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style) As Boolean

    Dim targetStyle As Style

    On Error GoTo HeadingError

    Select Case headingLevel
        Case 1
            Set targetStyle = styH1
        Case 2
            Set targetStyle = styH2
        Case 3
            Set targetStyle = styH3
        Case 4
            Set targetStyle = styH4
        Case Else
            Exit Function
    End Select

    ' Remove old list numbering before applying the newly linked style.
    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo HeadingError

    If REMOVE_TYPED_HEADING_NUMBERS Then
        StripTypedHeadingPrefix para, headingLevel
    End If

    para.Range.Style = targetStyle.NameLocal

    If RESET_DIRECT_PARAGRAPH_FORMATTING Then
        para.Range.ParagraphFormat.Reset
        para.Range.Style = targetStyle.NameLocal
    End If

    If ENFORCE_FONT_NAME_AND_SIZE Then
        EnforceFontNameAndSize para.Range, headingLevel
    End If

    ' Do NOT remove numbering again. The style is already linked to the
    ' fresh multilevel list template, so Word supplies the heading number.
    NormalizeLinkedHeadingV35 = True
    Exit Function

HeadingError:
    NormalizeLinkedHeadingV35 = False

End Function

Private Sub CleanAndFormatCaptionV35( _
                    ByVal para As Paragraph, _
                    ByVal captionType As Integer, _
                    ByVal targetStyle As Style)

    Dim contentRange As Range
    Dim textValue As String
    Dim removeLength As Long

    On Error Resume Next

    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph

    On Error GoTo 0

    Set contentRange = para.Range.Duplicate

    Do While contentRange.End > contentRange.Start
        If Right$(contentRange.Text, 1) = Chr$(13) Or _
           Right$(contentRange.Text, 1) = Chr$(7) Then

            contentRange.MoveEnd wdCharacter, -1
        Else
            Exit Do
        End If
    Loop

    textValue = contentRange.Text
    removeLength = TypedCaptionListPrefixLengthFastV35(textValue)

    If removeLength > 0 Then
        contentRange.End = contentRange.Start + removeLength
        contentRange.Delete
    End If

    para.Range.Style = targetStyle.NameLocal

    ' Remove any list inherited from an old heading style.
    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph
    On Error GoTo 0

    ApplyCaptionDirectFormatV35 para.Range, captionType

End Sub

Private Sub FormatAllTablesFastV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef formattedCount As Long, _
                    ByRef errorCount As Long, _
                    ByRef normalizedParagraphCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim tbl As Table

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each tbl In mainRange.Tables

        On Error GoTo TableError

        FormatOneTableGuaranteedV35 _
            tbl, styBody, normalizedParagraphCount

        formattedCount = formattedCount + 1

        If formattedCount Mod 10 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(formattedCount, "#,##0") & _
                " tables formatted"
            DoEvents
        End If

ContinueTable:
        On Error GoTo 0
    Next tbl

    Exit Sub

TableError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueTable

End Sub

Private Sub FormatOneTableGuaranteedV35( _
                    ByVal tbl As Table, _
                    ByVal styBody As Style, _
                    ByRef normalizedParagraphCount As Long)

    Dim tableRange As Range
    Dim cellItem As Cell
    Dim para As Paragraph
    Dim processedParagraphs As Long
    Dim normalStyleName As String

    Set tableRange = tbl.Range.Duplicate

    ' V35 critical change: table content must NOT use the Body style.
    ' Body intentionally has a two-character first-line indent.
    On Error Resume Next
    normalStyleName = tbl.Range.Document.Styles(wdStyleNormal).NameLocal
    If Len(normalStyleName) > 0 Then tableRange.Style = normalStyleName

    tbl.AllowAutoFit = True
    tbl.AutoFitBehavior wdAutoFitWindow
    tbl.Rows.LeftIndent = 0
    On Error GoTo 0

    SetRangeFontV10 _
        tableRange, FontFangSongGB2312Name(), "FangSong", 12

    On Error Resume Next
    tableRange.Font.Bold = False
    tableRange.Font.BoldBi = False
    On Error GoTo 0

    ApplyTableParagraphFormatV35 tableRange

    For Each cellItem In tbl.Range.Cells
        For Each para In cellItem.Range.Paragraphs
            NormalizeOneTableParagraphV35 para, normalStyleName
            normalizedParagraphCount = normalizedParagraphCount + 1
            processedParagraphs = processedParagraphs + 1
            If processedParagraphs Mod 500 = 0 Then DoEvents
        Next para
    Next cellItem

End Sub

Private Sub ApplyTableParagraphFormatV35( _
                    ByVal targetRange As Range)

    ApplyExactTableParagraphFormatV35 targetRange

End Sub

Private Sub NormalizeOneTableParagraphV35( _
                    ByVal para As Paragraph, _
                    ByVal normalStyleName As String)

    Dim targetRange As Range

    On Error Resume Next
    Set targetRange = para.Range.Duplicate

    If Len(normalStyleName) > 0 Then targetRange.Style = normalStyleName

    ' Remove any old direct paragraph indentation before applying table format.
    targetRange.ParagraphFormat.Reset
    ApplyExactTableParagraphFormatV35 targetRange

    With targetRange.Font
        .NameFarEast = FontFangSongGB2312Name()
        .NameAscii = EN_FONT
        .NameOther = EN_FONT
        .NameBi = EN_FONT
        .Size = 12
        .Bold = False
        .BoldBi = False
    End With
    On Error GoTo 0

    StripLeadingTableWhitespaceV35 para

    ' Re-apply after deleting leading whitespace.
    On Error Resume Next
    Set targetRange = para.Range.Duplicate
    ApplyExactTableParagraphFormatV35 targetRange
    targetRange.Font.Bold = False
    targetRange.Font.BoldBi = False
    On Error GoTo 0

    VerifyAndRepairTableParagraphIndentV35 para

End Sub

Private Sub ApplyExactTableParagraphFormatV35( _
                    ByVal targetRange As Range)

    On Error Resume Next
    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 20
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .DisableLineHeightGrid = True
    End With
    On Error GoTo 0

End Sub

Private Sub VerifyAndRepairTableParagraphIndentV35( _
                    ByVal para As Paragraph)

    Dim pFirst As Single
    Dim pLeft As Single
    Dim cFirst As Single
    Dim cLeft As Single
    Dim repairNeeded As Boolean

    On Error GoTo RepairRequired
    pFirst = para.Range.ParagraphFormat.FirstLineIndent
    pLeft = para.Range.ParagraphFormat.LeftIndent
    cFirst = para.Range.ParagraphFormat.CharacterUnitFirstLineIndent
    cLeft = para.Range.ParagraphFormat.CharacterUnitLeftIndent

    If pFirst <> 0 Then repairNeeded = True
    If pLeft <> 0 Then repairNeeded = True
    If cFirst <> 0 Then repairNeeded = True
    If cLeft <> 0 Then repairNeeded = True
    If repairNeeded Then GoTo RepairRequired
    Exit Sub

RepairRequired:
    Err.Clear
    On Error Resume Next
    With para.Range.ParagraphFormat
        ' Apply both point and character-unit zeros twice because Word can
        ' recalculate one representation after the other is changed.
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
    End With
    On Error GoTo 0

End Sub

Private Sub StripLeadingTableWhitespaceV35( _
                    ByVal para As Paragraph)

    Dim contentRange As Range
    Dim firstCharRange As Range
    Dim ch As String
    Dim safetyCounter As Long

    ' Work on the paragraph text but never delete the paragraph mark or
    ' the end-of-cell marker.
    Set contentRange = para.Range.Duplicate

    Do While contentRange.End > contentRange.Start
        If Right$(contentRange.Text, 1) = Chr$(13) Or _
           Right$(contentRange.Text, 1) = Chr$(7) Then

            contentRange.MoveEnd wdCharacter, -1
        Else
            Exit Do
        End If
    Loop

    safetyCounter = 0

    Do While contentRange.End > contentRange.Start

        Set firstCharRange = contentRange.Duplicate
        firstCharRange.End = firstCharRange.Start + 1
        ch = firstCharRange.Text

        If IsTableLeadingWhitespaceV35(ch) Then
            firstCharRange.Delete
            contentRange.End = contentRange.End - 1

            safetyCounter = safetyCounter + 1
            If safetyCounter >= 100 Then Exit Do
        Else
            Exit Do
        End If
    Loop

End Sub

Private Function IsTableLeadingWhitespaceV35( _
                    ByVal ch As String) As Boolean

    Dim codeValue As Long

    If Len(ch) = 0 Then Exit Function

    If ch = " " Or ch = vbTab Then
        IsTableLeadingWhitespaceV35 = True
        Exit Function
    End If

    codeValue = AscW(ch)

    Select Case codeValue
        Case 160, 12288
            IsTableLeadingWhitespaceV35 = True
        Case 8192 To 8203
            IsTableLeadingWhitespaceV35 = True
        Case 8239, 8287, 65279
            IsTableLeadingWhitespaceV35 = True
    End Select

End Function

Private Function TableNeedsCellFallbackV35( _
                    ByVal tbl As Table) As Boolean

    Dim pointValue As Single
    Dim characterValue As Single

    On Error GoTo NeedsFallback

    pointValue = tbl.Range.ParagraphFormat.FirstLineIndent
    characterValue = _
        tbl.Range.ParagraphFormat.CharacterUnitFirstLineIndent

    If pointValue <> 0 Or characterValue <> 0 Then
        TableNeedsCellFallbackV35 = True
    End If

    Exit Function

NeedsFallback:
    TableNeedsCellFallbackV35 = True

End Function

Private Sub ForceZeroCellIndentUltraV35( _
                    ByVal cellRange As Range)

    On Error Resume Next

    With cellRange.ParagraphFormat
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
    End With

    On Error GoTo 0

End Sub

' ============================================================
' V35 TWO-PASS FAST ENGINE
' ============================================================

Private Function ScanDocumentAndFormatBodyV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef specialStarts() As Long, _
                    ByRef specialKinds() As Integer, _
                    ByRef bodyParagraphCount As Long, _
                    ByRef bodyRangeCount As Long, _
                    ByRef headingLocatedCount As Long, _
                    ByRef figureLocatedCount As Long, _
                    ByRef tableCaptionLocatedCount As Long, _
                    ByVal stepName As String) As Long

    Const SPECIAL_GROW_BY As Long = 512

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim styleCache As Object
    Dim pictureParagraphs As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim capacity As Long
    Dim specialCount As Long
    Dim paragraphKind As Integer
    Dim captionType As Integer
    Dim listLevel As Integer
    Dim scannedCount As Long

    Dim runOpen As Boolean
    Dim runStart As Long
    Dim runEnd As Long
    Dim runParagraphs As Long

    capacity = SPECIAL_GROW_BY
    ReDim specialStarts(1 To capacity)
    ReDim specialKinds(1 To capacity)

    Set styleCache = CreateObject("Scripting.Dictionary")
    styleCache.CompareMode = vbTextCompare

    Set pictureParagraphs = CreateObject("Scripting.Dictionary")
    BuildPictureParagraphMapV35 doc, pictureParagraphs

    BuildTableOfContentsBoundaries _
        doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1
        Set paraRange = para.Range.Duplicate

        paragraphKind = 0
        captionType = 0

        If paraRange.Information(wdWithInTable) Then
            FlushBodyRunV35 _
                doc, runOpen, runStart, runEnd, runParagraphs, _
                styBody, bodyParagraphCount, bodyRangeCount
        ElseIf IsPositionInsideTocSequentialV35( _
                paraRange.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            FlushBodyRunV35 _
                doc, runOpen, runStart, runEnd, runParagraphs, _
                styBody, bodyParagraphCount, bodyRangeCount
        ElseIf pictureParagraphs.Exists( _
                CStr(paraRange.Start)) Then

            FlushBodyRunV35 _
                doc, runOpen, runStart, runEnd, runParagraphs, _
                styBody, bodyParagraphCount, bodyRangeCount
        Else
            ' Caption detection must happen before heading detection.
            ' This corrects captions that were previously given Style 1.
            captionType = DetectCaptionTypeFastV35( _
                para, styCaption, styFigureCaption, styTableCaption)

            If captionType > 0 Then
                FlushBodyRunV35 _
                    doc, runOpen, runStart, runEnd, runParagraphs, _
                    styBody, bodyParagraphCount, bodyRangeCount

                specialCount = specialCount + 1
                EnsureSpecialCapacityV35 _
                    specialStarts, specialKinds, _
                    capacity, specialCount, SPECIAL_GROW_BY

                specialStarts(specialCount) = paraRange.Start

                If captionType = 1 Then
                    specialKinds(specialCount) = 101
                    figureLocatedCount = figureLocatedCount + 1
                Else
                    specialKinds(specialCount) = 102
                    tableCaptionLocatedCount = _
                        tableCaptionLocatedCount + 1
                End If
            Else
                paragraphKind = _
                    DetectParagraphKindFast(doc, para, styleCache)

                If paragraphKind = 5 Then
                    ' A generic caption without a figure/table label is
                    ' preserved and excluded from body formatting.
                    FlushBodyRunV35 _
                        doc, runOpen, runStart, runEnd, runParagraphs, _
                        styBody, bodyParagraphCount, bodyRangeCount
                Else
                    If paragraphKind = 0 Then
                        listLevel = ExistingListLevelV35(para)

                        If listLevel >= 1 And listLevel <= 4 Then
                            paragraphKind = listLevel
                        Else
                            paragraphKind = _
                                DetectTypedHeadingLevelV35( _
                                    paraRange.Text)
                        End If
                    End If

                    If paragraphKind >= 1 And paragraphKind <= 4 Then
                        FlushBodyRunV35 _
                            doc, runOpen, runStart, runEnd, _
                            runParagraphs, styBody, _
                            bodyParagraphCount, bodyRangeCount

                        specialCount = specialCount + 1
                        EnsureSpecialCapacityV35 _
                            specialStarts, specialKinds, _
                            capacity, specialCount, SPECIAL_GROW_BY

                        specialStarts(specialCount) = paraRange.Start
                        specialKinds(specialCount) = paragraphKind
                        headingLocatedCount = headingLocatedCount + 1
                    Else
                        If Not runOpen Then
                            runOpen = True
                            runStart = paraRange.Start
                            runParagraphs = 0
                        End If

                        runEnd = paraRange.End
                        runParagraphs = runParagraphs + 1
                    End If
                End If
            End If
        End If

        If scannedCount Mod 500 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; body ranges " & _
                Format$(bodyRangeCount, "#,##0") & _
                "; special " & _
                Format$(specialCount, "#,##0")
            DoEvents
        End If
    Next para

    FlushBodyRunV35 _
        doc, runOpen, runStart, runEnd, runParagraphs, _
        styBody, bodyParagraphCount, bodyRangeCount

    If specialCount > 0 Then
        ReDim Preserve specialStarts(1 To specialCount)
        ReDim Preserve specialKinds(1 To specialCount)
    End If

    ScanDocumentAndFormatBodyV35 = specialCount

End Function

Private Sub BuildPictureParagraphMapV35( _
                    ByVal doc As Document, _
                    ByVal paragraphMap As Object)

    Dim mainRange As Range
    Dim ils As InlineShape
    Dim shp As Shape
    Dim paraStart As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each ils In mainRange.InlineShapes
        On Error Resume Next
        paraStart = ils.Range.Paragraphs(1).Range.Start
        paragraphMap(CStr(paraStart)) = True
        On Error GoTo 0
    Next ils

    For Each shp In doc.Shapes
        If IsPictureShapeV10(shp) Then
            On Error Resume Next
            paraStart = shp.Anchor.Paragraphs(1).Range.Start
            paragraphMap(CStr(paraStart)) = True
            On Error GoTo 0
        End If
    Next shp

End Sub

Private Sub EnsureSpecialCapacityV35( _
                    ByRef starts() As Long, _
                    ByRef kinds() As Integer, _
                    ByRef capacity As Long, _
                    ByVal requiredCount As Long, _
                    ByVal growBy As Long)

    If requiredCount <= capacity Then Exit Sub

    capacity = capacity + growBy
    ReDim Preserve starts(1 To capacity)
    ReDim Preserve kinds(1 To capacity)

End Sub

Private Sub FlushBodyRunV35( _
                    ByVal doc As Document, _
                    ByRef runOpen As Boolean, _
                    ByRef runStart As Long, _
                    ByRef runEnd As Long, _
                    ByRef runParagraphs As Long, _
                    ByVal styBody As Style, _
                    ByRef bodyParagraphCount As Long, _
                    ByRef bodyRangeCount As Long)

    Dim targetRange As Range

    If Not runOpen Then Exit Sub
    If runEnd <= runStart Then
        runOpen = False
        runParagraphs = 0
        Exit Sub
    End If

    Set targetRange = doc.Range(runStart, runEnd)

    On Error Resume Next

    targetRange.Style = styBody.NameLocal

    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphJustify
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 24
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitFirstLineIndent = 2
    End With

    EnforceFontNameAndSize targetRange, 0

    On Error GoTo 0

    bodyParagraphCount = bodyParagraphCount + runParagraphs
    bodyRangeCount = bodyRangeCount + 1

    runOpen = False
    runStart = 0
    runEnd = 0
    runParagraphs = 0

End Sub

Private Function DetectCaptionTypeFastV35( _
                    ByVal para As Paragraph, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style) As Integer

    Dim styleName As String
    Dim textValue As String

    styleName = SafeParagraphStyleNameV35(para)
    textValue = CleanParagraphTextV35(para.Range.Text)

    ' Text label has priority, even if the current style is Style 1.
    If StartsWithCaptionLabelV35(textValue, 1) Then
        DetectCaptionTypeFastV35 = 1
        Exit Function
    End If

    If StartsWithCaptionLabelV35(textValue, 2) Then
        DetectCaptionTypeFastV35 = 2
        Exit Function
    End If

    If StrComp( _
            styleName, styFigureCaption.NameLocal, _
            vbTextCompare) = 0 Then

        DetectCaptionTypeFastV35 = 1
        Exit Function
    End If

    If StrComp( _
            styleName, styTableCaption.NameLocal, _
            vbTextCompare) = 0 Then

        DetectCaptionTypeFastV35 = 2
        Exit Function
    End If

    ' A generic Caption style without a clear label is not guessed.
    If StrComp( _
            styleName, styCaption.NameLocal, _
            vbTextCompare) = 0 Then

        DetectCaptionTypeFastV35 = 0
    End If

End Function

Private Function DetectTypedHeadingLevelV35( _
                    ByVal paragraphText As String) As Integer

    Static regex1 As Object
    Static regex2 As Object
    Static regex3 As Object
    Static regex4 As Object
    Dim cleanText As String

    cleanText = CleanParagraphTextV35(paragraphText)

    ' Avoid treating long numbered body paragraphs as headings.
    If Len(cleanText) = 0 Or Len(cleanText) > 120 Then Exit Function

    On Error GoTo SafeExit

    If regex1 Is Nothing Then
        Set regex1 = CreateObject("VBScript.RegExp")
        Set regex2 = CreateObject("VBScript.RegExp")
        Set regex3 = CreateObject("VBScript.RegExp")
        Set regex4 = CreateObject("VBScript.RegExp")

        ConfigureHeadingRegexV35 regex1, 1
        ConfigureHeadingRegexV35 regex2, 2
        ConfigureHeadingRegexV35 regex3, 3
        ConfigureHeadingRegexV35 regex4, 4
    End If

    If regex4.Test(cleanText) Then
        DetectTypedHeadingLevelV35 = 4
    ElseIf regex3.Test(cleanText) Then
        DetectTypedHeadingLevelV35 = 3
    ElseIf regex2.Test(cleanText) Then
        DetectTypedHeadingLevelV35 = 2
    ElseIf regex1.Test(cleanText) Then
        DetectTypedHeadingLevelV35 = 1
    End If

SafeExit:
End Function

Private Sub ConfigureHeadingRegexV35( _
                    ByVal regexObject As Object, _
                    ByVal headingLevel As Integer)

    With regexObject
        .Global = False
        .IgnoreCase = True
        .Pattern = BuildHeadingPrefixPattern(headingLevel)
    End With

End Sub

Private Sub ProcessSpecialParagraphsBottomUpV35( _
                    ByVal doc As Document, _
                    ByRef specialStarts() As Long, _
                    ByRef specialKinds() As Integer, _
                    ByVal specialCount As Long, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef figureCount As Long, _
                    ByRef tableCaptionCount As Long, _
                    ByRef captionErrorCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim pointRange As Range
    Dim para As Paragraph
    Dim paragraphKind As Integer

    For i = specialCount To 1 Step -1

        paragraphKind = specialKinds(i)

        On Error GoTo SpecialError

        Set pointRange = doc.Range( _
            Start:=specialStarts(i), _
            End:=specialStarts(i))
        Set para = pointRange.Paragraphs(1)

        If paragraphKind >= 1 And paragraphKind <= 4 Then
            NormalizeOneParagraph _
                para, paragraphKind, _
                styBody, styH1, styH2, styH3, _
                styH4, styCaption
        ElseIf paragraphKind = 101 Then
            RemoveCaptionAutomaticNumberingV35 para
            para.Range.Style = styFigureCaption.NameLocal
            ApplyCaptionDirectFormatV35 para.Range, 1

            ' Re-remove any numbering inherited from the old Style 1.
            RemoveCaptionAutomaticNumberingV35 para
            ApplyCaptionDirectFormatV35 para.Range, 1

            figureCount = figureCount + 1
        ElseIf paragraphKind = 102 Then
            RemoveCaptionAutomaticNumberingV35 para
            para.Range.Style = styTableCaption.NameLocal
            ApplyCaptionDirectFormatV35 para.Range, 2
            RemoveCaptionAutomaticNumberingV35 para
            ApplyCaptionDirectFormatV35 para.Range, 2

            tableCaptionCount = tableCaptionCount + 1
        End If

ContinueSpecial:
        On Error GoTo 0

        If i Mod 100 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(specialCount - i + 1, "#,##0") & _
                " / " & Format$(specialCount, "#,##0")
            DoEvents
        End If
    Next i

    Exit Sub

SpecialError:
    If paragraphKind = 101 Or paragraphKind = 102 Then
        captionErrorCount = captionErrorCount + 1
    End If

    Err.Clear
    Resume ContinueSpecial

End Sub

Private Sub NumberExactHeadingStylesV35( _
                    ByVal doc As Document, _
                    ByVal lt As ListTemplate, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByRef headingCount As Long, _
                    ByRef errorCount As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim headingLevel As Integer
    Dim captionType As Integer
    Dim firstHeading As Boolean
    Dim continuePrevious As Boolean
    Dim scannedCount As Long

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    BuildTableOfContentsBoundaries _
        doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    firstHeading = True
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not para.Range.Information(wdWithInTable) Then
            If Not IsPositionInsideTocSequentialV35( _
                    para.Range.Start, tocStarts, tocEnds, _
                    tocCount, tocIndex) Then

                ' Never infer a heading from outline/list level here.
                ' Captions are explicitly excluded first.
                captionType = DetectCaptionTypeFastV35( _
                    para, doc.Styles(StyleCaptionName()), _
                    doc.Styles(StyleFigureCaptionName()), _
                    doc.Styles(StyleTableCaptionName()))

                If captionType = 0 Then
                    headingLevel = ExactHeadingStyleLevelV35( _
                        para, styH1, styH2, styH3, styH4)

                    If headingLevel > 0 Then

                        If headingLevel = 4 Then
                            On Error Resume Next
                            Err.Clear

                            para.Range.Style = styH4.NameLocal
                            ApplyLevel4DirectFormatV35 para.Range

                            If Err.Number = 0 Then
                                level4Count = level4Count + 1
                            Else
                                level4ErrorCount = _
                                    level4ErrorCount + 1
                            End If

                            Err.Clear
                            On Error GoTo 0
                        End If

                        continuePrevious = Not firstHeading

                        If ApplyNumberingToOneParagraph( _
                                para, lt, headingLevel, _
                                continuePrevious) Then

                            headingCount = headingCount + 1
                            firstHeading = False
                        Else
                            errorCount = errorCount + 1
                        End If
                    End If
                End If
            End If
        End If

        If scannedCount Mod 500 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; numbered " & _
                Format$(headingCount, "#,##0")
            DoEvents
        End If
    Next para

End Sub

Private Function ExactHeadingStyleLevelV35( _
                    ByVal para As Paragraph, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style) As Integer

    Dim styleName As String

    styleName = SafeParagraphStyleNameV35(para)

    If StrComp( _
            styleName, styH1.NameLocal, _
            vbTextCompare) = 0 Then

        ExactHeadingStyleLevelV35 = 1
    ElseIf StrComp( _
            styleName, styH2.NameLocal, _
            vbTextCompare) = 0 Then

        ExactHeadingStyleLevelV35 = 2
    ElseIf StrComp( _
            styleName, styH3.NameLocal, _
            vbTextCompare) = 0 Then

        ExactHeadingStyleLevelV35 = 3
    ElseIf StrComp( _
            styleName, styH4.NameLocal, _
            vbTextCompare) = 0 Then

        ExactHeadingStyleLevelV35 = 4
    End If

End Function

' ============================================================
' V35 STREAMING SAFE ENGINE
' ============================================================

Private Sub FormatBodyParagraphsStreamingV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByVal styCaption As Style, _
                    ByRef formattedCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim styleName As String
    Dim scannedCount As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1
        Set paraRange = para.Range.Duplicate

        If Not paraRange.Information(wdWithInTable) Then
            If Not IsInsideAnyTableOfContentsV35( _
                    doc, paraRange.Start) Then

                styleName = SafeParagraphStyleNameV35(para)

                If Not IsHeadingStyleNameV35(styleName) And _
                   Not IsCaptionParagraphV35( _
                       para, styCaption.NameLocal) And _
                   Not ParagraphContainsPictureV35(para) Then

                    On Error Resume Next

                    paraRange.Style = styBody.NameLocal

                    With paraRange.ParagraphFormat
                        .OutlineLevel = wdOutlineLevelBodyText
                        .Alignment = wdAlignParagraphJustify
                        .SpaceBefore = 0
                        .SpaceAfter = 0
                        .LineSpacingRule = wdLineSpaceExactly
                        .LineSpacing = 24
                        .LeftIndent = 0
                        .RightIndent = 0
                        .CharacterUnitFirstLineIndent = 2
                    End With

                    EnforceFontNameAndSize paraRange, 0

                    If Err.Number = 0 Then
                        formattedCount = formattedCount + 1
                    End If

                    Err.Clear
                    On Error GoTo 0
                End If
            End If
        End If

        If scannedCount Mod 300 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; formatted " & _
                Format$(formattedCount, "#,##0")
            DoEvents
        End If
    Next para

End Sub

Private Sub FormatAllTablesStreamingV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef formattedCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim tbl As Table
    Dim cellItem As Cell
    Dim cellCount As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each tbl In mainRange.Tables

        On Error GoTo TableError

        With tbl.Range
            .Style = styBody.NameLocal

            With .ParagraphFormat
                .OutlineLevel = wdOutlineLevelBodyText
                .Alignment = wdAlignParagraphCenter
                .SpaceBefore = 0
                .SpaceAfter = 0
                .LineSpacingRule = wdLineSpaceExactly
                .LineSpacing = 20
                .LeftIndent = 0
                .RightIndent = 0
                .CharacterUnitLeftIndent = 0
                .CharacterUnitRightIndent = 0
                .CharacterUnitFirstLineIndent = 0
                .FirstLineIndent = 0
                .DisableLineHeightGrid = True
            End With
        End With

        SetRangeFontV10 _
            tbl.Range, FontFangSongGB2312Name(), "FangSong", 12

        On Error Resume Next
        tbl.AllowAutoFit = True
        tbl.AutoFitBehavior wdAutoFitWindow
        tbl.Rows.LeftIndent = 0
        On Error GoTo TableError

        ' Always reinforce zero indentation for every cell.
        For Each cellItem In tbl.Range.Cells
            With cellItem.Range.ParagraphFormat
                .LeftIndent = 0
                .RightIndent = 0
                .CharacterUnitLeftIndent = 0
                .CharacterUnitRightIndent = 0
                .CharacterUnitFirstLineIndent = 0
                .FirstLineIndent = 0
            End With

            cellCount = cellCount + 1
            If cellCount Mod 500 = 0 Then DoEvents
        Next cellItem

        formattedCount = formattedCount + 1

        If formattedCount Mod 10 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(formattedCount, "#,##0") & _
                " tables formatted"
            DoEvents
        End If

ContinueTable:
        On Error GoTo 0
    Next tbl

    Exit Sub

TableError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueTable

End Sub

Private Sub FormatAllPicturesV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef inlineCount As Long, _
                    ByRef floatingCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim ils As InlineShape
    Dim shp As Shape
    Dim pictureParagraph As Paragraph
    Dim totalDone As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each ils In mainRange.InlineShapes

        On Error GoTo InlineError

        Set pictureParagraph = ils.Range.Paragraphs(1)

        If ParagraphIsObjectOnlyV10(pictureParagraph) Then
            pictureParagraph.Range.Style = styBody.NameLocal
            RemoveParagraphNumberingV10 pictureParagraph
        End If

        ApplyPictureParagraphFormatV35 pictureParagraph

        inlineCount = inlineCount + 1
        totalDone = totalDone + 1

        If totalDone Mod 50 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(totalDone, "#,##0") & _
                " picture objects formatted"
            DoEvents
        End If

ContinueInline:
        On Error GoTo 0
    Next ils

    For Each shp In doc.Shapes

        If IsPictureShapeV10(shp) Then

            On Error GoTo FloatingError

            On Error Resume Next
            shp.RelativeHorizontalPosition = _
                wdRelativeHorizontalPositionMargin
            shp.Left = wdShapeCenter
            On Error GoTo FloatingError

            Set pictureParagraph = shp.Anchor.Paragraphs(1)

            If ParagraphIsObjectOnlyV10(pictureParagraph) Then
                pictureParagraph.Range.Style = styBody.NameLocal
                RemoveParagraphNumberingV10 pictureParagraph
            End If

            ApplyPictureParagraphFormatV35 pictureParagraph

            floatingCount = floatingCount + 1
            totalDone = totalDone + 1

ContinueFloating:
            On Error GoTo 0
        End If
    Next shp

    Exit Sub

InlineError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueInline

FloatingError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueFloating

End Sub

Private Sub ApplyPictureParagraphFormatV35( _
                    ByVal para As Paragraph)

    On Error Resume Next

    With para.Range.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .SpaceBefore = 0
        .SpaceAfter = 0

        ' Picture paragraph uses true single line spacing.
        .LineSpacingRule = wdLineSpaceSingle

        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
        .DisableLineHeightGrid = True
    End With

    On Error GoTo 0

End Sub

Private Sub FormatCaptionsOnlyV35( _
                    ByVal doc As Document, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef figureCount As Long, _
                    ByRef tableCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim captionType As Integer
    Dim scannedCount As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not para.Range.Information(wdWithInTable) Then
            captionType = DetectCaptionTypeStreamingV35(para)

            If captionType > 0 Then
                On Error GoTo CaptionError

                RemoveCaptionAutomaticNumberingV35 para

                If captionType = 1 Then
                    para.Range.Style = styFigureCaption.NameLocal
                    ApplyCaptionDirectFormatV35 para.Range, 1
                    figureCount = figureCount + 1
                Else
                    para.Range.Style = styTableCaption.NameLocal
                    ApplyCaptionDirectFormatV35 para.Range, 2
                    tableCount = tableCount + 1
                End If
            End If
        End If

ContinueCaption:
        On Error GoTo 0

        If scannedCount Mod 300 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; captions " & _
                Format$(figureCount + tableCount, "#,##0")
            DoEvents
        End If
    Next para

    Exit Sub

CaptionError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueCaption

End Sub

Private Sub FormatHeadingsStreamingV35( _
                    ByVal doc As Document, _
                    ByVal lt As ListTemplate, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByRef headingCount As Long, _
                    ByRef errorCount As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByVal stepName As String)

    Dim headingStarts() As Long
    Dim headingLevels() As Integer
    Dim headingCountIndexed As Long
    Dim capacity As Long
    Dim mainRange As Range
    Dim para As Paragraph
    Dim headingLevel As Integer
    Dim scannedCount As Long
    Dim i As Long
    Dim workRange As Range
    Dim headingPara As Paragraph
    Dim continuePrevious As Boolean
    Dim firstHeading As Boolean

    capacity = 256
    ReDim headingStarts(1 To capacity)
    ReDim headingLevels(1 To capacity)

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' Save only heading positions, not every paragraph position.
    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not para.Range.Information(wdWithInTable) Then
            If Not IsInsideAnyTableOfContentsV35( _
                    doc, para.Range.Start) Then

                headingLevel = DetectHeadingLevelStreamingV35(para)

                If headingLevel > 0 Then
                    headingCountIndexed = headingCountIndexed + 1

                    If headingCountIndexed > capacity Then
                        capacity = capacity + 256
                        ReDim Preserve headingStarts(1 To capacity)
                        ReDim Preserve headingLevels(1 To capacity)
                    End If

                    headingStarts(headingCountIndexed) = para.Range.Start
                    headingLevels(headingCountIndexed) = headingLevel
                End If
            End If
        End If

        If scannedCount Mod 300 = 0 Then
            Application.StatusBar = _
                stepName & ": locating headings; scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; found " & _
                Format$(headingCountIndexed, "#,##0")
            DoEvents
        End If
    Next para

    ' Remove typed prefixes and apply styles bottom-up.
    For i = headingCountIndexed To 1 Step -1

        Set workRange = doc.Range( _
            Start:=headingStarts(i), _
            End:=headingStarts(i))
        Set headingPara = workRange.Paragraphs(1)

        On Error Resume Next

        Select Case headingLevels(i)
            Case 1
                NormalizeOneParagraph _
                    headingPara, 1, styH1, styH1, styH2, _
                    styH3, styH4, styH1
            Case 2
                NormalizeOneParagraph _
                    headingPara, 2, styH1, styH1, styH2, _
                    styH3, styH4, styH1
            Case 3
                NormalizeOneParagraph _
                    headingPara, 3, styH1, styH1, styH2, _
                    styH3, styH4, styH1
            Case 4
                NormalizeOneParagraph _
                    headingPara, 4, styH1, styH1, styH2, _
                    styH3, styH4, styH1
        End Select

        On Error GoTo 0
    Next i

    ' Apply numbering in forward order using the saved heading positions.
    firstHeading = True

    For i = 1 To headingCountIndexed

        On Error GoTo NumberError

        Set workRange = doc.Range( _
            Start:=headingStarts(i), _
            End:=headingStarts(i))
        Set headingPara = workRange.Paragraphs(1)

        If headingLevels(i) = 4 Then
            On Error Resume Next
            headingPara.Range.Style = styH4.NameLocal
            ApplyLevel4DirectFormatV35 headingPara.Range

            If Err.Number = 0 Then
                level4Count = level4Count + 1
            Else
                level4ErrorCount = level4ErrorCount + 1
            End If

            Err.Clear
            On Error GoTo NumberError
        End If

        continuePrevious = Not firstHeading

        If ApplyNumberingToOneParagraph( _
                headingPara, lt, headingLevels(i), _
                continuePrevious) Then

            headingCount = headingCount + 1
            firstHeading = False
        Else
            errorCount = errorCount + 1
        End If

ContinueNumber:
        On Error GoTo 0

        If i Mod 100 = 0 Then
            Application.StatusBar = _
                stepName & ": numbering " & _
                Format$(i, "#,##0") & _
                " / " & Format$(headingCountIndexed, "#,##0")
            DoEvents
        End If
    Next i

    Exit Sub

NumberError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueNumber

End Sub

Private Function DetectHeadingLevelStreamingV35( _
                    ByVal para As Paragraph) As Integer

    Dim styleName As String
    Dim listLevel As Integer

    styleName = SafeParagraphStyleNameV35(para)

    DetectHeadingLevelStreamingV35 = _
        HeadingLevelFromStyleNameV35(styleName)

    If DetectHeadingLevelStreamingV35 > 0 Then Exit Function

    listLevel = ExistingListLevelV35(para)

    If listLevel >= 1 And listLevel <= 4 Then
        DetectHeadingLevelStreamingV35 = listLevel
        Exit Function
    End If

    Select Case para.OutlineLevel
        Case wdOutlineLevel1
            DetectHeadingLevelStreamingV35 = 1
        Case wdOutlineLevel2
            DetectHeadingLevelStreamingV35 = 2
        Case wdOutlineLevel3
            DetectHeadingLevelStreamingV35 = 3
        Case wdOutlineLevel4
            DetectHeadingLevelStreamingV35 = 4
    End Select

End Function

Private Function HeadingLevelFromStyleNameV35( _
                    ByVal styleName As String) As Integer

    Dim normalizedName As String

    normalizedName = LCase$(Trim$(styleName))

    If normalizedName = LCase$(StyleH1Name()) Or _
       normalizedName = "heading 1" Then
        HeadingLevelFromStyleNameV35 = 1
    ElseIf normalizedName = LCase$(StyleH2Name()) Or _
           normalizedName = "heading 2" Then
        HeadingLevelFromStyleNameV35 = 2
    ElseIf normalizedName = LCase$(StyleH3Name()) Or _
           normalizedName = "heading 3" Then
        HeadingLevelFromStyleNameV35 = 3
    ElseIf normalizedName = LCase$(StyleH4Name()) Or _
           normalizedName = "heading 4" Then
        HeadingLevelFromStyleNameV35 = 4
    End If

End Function

Private Function IsHeadingStyleNameV35( _
                    ByVal styleName As String) As Boolean

    IsHeadingStyleNameV35 = _
        (HeadingLevelFromStyleNameV35(styleName) > 0)

End Function

Private Function SafeParagraphStyleNameV35( _
                    ByVal para As Paragraph) As String

    Dim sty As Style

    On Error Resume Next
    Set sty = para.Range.Style

    If Not sty Is Nothing Then
        SafeParagraphStyleNameV35 = sty.NameLocal
    End If

    On Error GoTo 0

End Function

Private Function IsInsideAnyTableOfContentsV35( _
                    ByVal doc As Document, _
                    ByVal position As Long) As Boolean

    Dim toc As TableOfContents

    For Each toc In doc.TablesOfContents
        If position >= toc.Range.Start And _
           position < toc.Range.End Then

            IsInsideAnyTableOfContentsV35 = True
            Exit Function
        End If
    Next toc

End Function

Private Function ParagraphContainsPictureV35( _
                    ByVal para As Paragraph) As Boolean

    On Error Resume Next

    ParagraphContainsPictureV35 = _
        (para.Range.InlineShapes.Count > 0)

    On Error GoTo 0

End Function

Private Function IsCaptionParagraphV35( _
                    ByVal para As Paragraph, _
                    ByVal genericCaptionStyleName As String) As Boolean

    Dim styleName As String

    styleName = SafeParagraphStyleNameV35(para)

    If StrComp( _
            styleName, genericCaptionStyleName, _
            vbTextCompare) = 0 Then

        IsCaptionParagraphV35 = True
        Exit Function
    End If

    IsCaptionParagraphV35 = _
        (DetectCaptionTypeStreamingV35(para) > 0)

End Function

Private Function DetectCaptionTypeStreamingV35( _
                    ByVal para As Paragraph) As Integer

    Dim styleName As String
    Dim textValue As String

    styleName = SafeParagraphStyleNameV35(para)

    If StrComp( _
            styleName, StyleFigureCaptionName(), _
            vbTextCompare) = 0 Then

        DetectCaptionTypeStreamingV35 = 1
        Exit Function
    End If

    If StrComp( _
            styleName, StyleTableCaptionName(), _
            vbTextCompare) = 0 Then

        DetectCaptionTypeStreamingV35 = 2
        Exit Function
    End If

    textValue = CleanParagraphTextV35(para.Range.Text)

    If StartsWithCaptionLabelV35(textValue, 1) Then
        DetectCaptionTypeStreamingV35 = 1
    ElseIf StartsWithCaptionLabelV35(textValue, 2) Then
        DetectCaptionTypeStreamingV35 = 2
    End If

End Function

' ============================================================
' V35 INDEXED ENGINE
' ============================================================

Private Function CaptureStructuralIndexV35( _
                    ByVal doc As Document, _
                    ByRef paraStarts() As Long, _
                    ByRef paraEnds() As Long, _
                    ByRef paraKinds() As Integer, _
                    ByRef tableParagraphCount As Long, _
                    ByRef tocParagraphCount As Long, _
                    ByVal stepName As String) As Long

    Const PROGRESS_EVERY As Long = 250

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim styleCache As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim capacity As Long
    Dim count As Long
    Dim inTable As Boolean

    capacity = INDEX_GROW_BY

    ReDim paraStarts(1 To capacity)
    ReDim paraEnds(1 To capacity)
    ReDim paraKinds(1 To capacity)

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    Set styleCache = CreateObject("Scripting.Dictionary")
    styleCache.CompareMode = vbTextCompare

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        count = count + 1

        If count > capacity Then
            capacity = capacity + INDEX_GROW_BY
            ReDim Preserve paraStarts(1 To capacity)
            ReDim Preserve paraEnds(1 To capacity)
            ReDim Preserve paraKinds(1 To capacity)
        End If

        Set paraRange = para.Range.Duplicate

        paraStarts(count) = paraRange.Start
        paraEnds(count) = paraRange.End

        If PRESERVE_TABLES_OF_CONTENTS And _
           IsPositionInsideTocSequentialV35( _
               paraRange.Start, tocStarts, tocEnds, _
               tocCount, tocIndex) Then

            paraKinds(count) = PARA_KIND_TOC
            tocParagraphCount = tocParagraphCount + 1
        Else
            inTable = False

            On Error Resume Next
            inTable = paraRange.Information(wdWithInTable)
            On Error GoTo 0

            If inTable Then
                ' Tables are formatted once through Table.Range later.
                ' Skipping them here prevents thousands of duplicate calls.
                paraKinds(count) = PARA_KIND_TABLE
                tableParagraphCount = tableParagraphCount + 1
            Else
                paraKinds(count) = _
                    DetectParagraphKindFast(doc, para, styleCache)
            End If
        End If

        If count Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": " & Format$(count, "#,##0") & _
                " paragraphs indexed"
            DoEvents
        End If

    Next para

    If count > 0 Then
        ReDim Preserve paraStarts(1 To count)
        ReDim Preserve paraEnds(1 To count)
        ReDim Preserve paraKinds(1 To count)
    End If

    CaptureStructuralIndexV35 = count

End Function

Private Function IsPositionInsideTocSequentialV35( _
                    ByVal position As Long, _
                    ByRef tocStarts() As Long, _
                    ByRef tocEnds() As Long, _
                    ByVal tocCount As Long, _
                    ByRef tocIndex As Long) As Boolean

    If tocCount = 0 Then Exit Function
    If tocIndex < 1 Then tocIndex = 1

    Do While tocIndex <= tocCount And _
             position >= tocEnds(tocIndex)
        tocIndex = tocIndex + 1
    Loop

    If tocIndex <= tocCount Then
        IsPositionInsideTocSequentialV35 = _
            (position >= tocStarts(tocIndex) And _
             position < tocEnds(tocIndex))
    End If

End Function

Private Sub NormalizeIndexedParagraphsV35( _
                    ByVal doc As Document, _
                    ByRef paraStarts() As Long, _
                    ByRef paraEnds() As Long, _
                    ByRef paraKinds() As Integer, _
                    ByVal paraCount As Long, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByRef processedCount As Long, _
                    ByRef skippedCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim runStartIndex As Long
    Dim runEndIndex As Long
    Dim runParagraphCount As Long
    Dim workRange As Range
    Dim para As Paragraph
    Dim completed As Long

    ' Pass 1: group adjacent body paragraphs into large ranges.
    ' Most long documents consist mainly of body text, so this removes
    ' thousands of paragraph-by-paragraph Word automation calls.
    i = 1

    Do While i <= paraCount

        If paraKinds(i) = 0 Then
            runStartIndex = i
            runEndIndex = i

            Do While runEndIndex < paraCount And _
                     paraKinds(runEndIndex + 1) = 0
                runEndIndex = runEndIndex + 1
            Loop

            Set workRange = doc.Range( _
                Start:=paraStarts(runStartIndex), _
                End:=paraEnds(runEndIndex))

            ApplyBodyRangeFormattingV35 workRange, styBody

            runParagraphCount = runEndIndex - runStartIndex + 1
            processedCount = processedCount + runParagraphCount
            i = runEndIndex + 1
        Else
            i = i + 1
        End If

        If i Mod 500 = 0 Then
            Application.StatusBar = _
                stepName & ": body ranges processed through paragraph " & _
                Format$(i, "#,##0")
            DoEvents
        End If

    Loop

    ' Pass 2: headings and generic captions may change text.
    ' Process them bottom-up so stored positions remain valid.
    For i = paraCount To 1 Step -1

        Select Case paraKinds(i)
            Case 1, 2, 3, 4, 5
                Set workRange = Nothing
                Set para = Nothing

                On Error Resume Next
                Set workRange = doc.Range( _
                    Start:=paraStarts(i), _
                    End:=paraEnds(i))
                Set para = workRange.Paragraphs(1)
                On Error GoTo 0

                If para Is Nothing Then
                    skippedCount = skippedCount + 1
                ElseIf NormalizeOneParagraph( _
                        para, paraKinds(i), _
                        styBody, styH1, styH2, styH3, _
                        styH4, styCaption) Then

                    processedCount = processedCount + 1
                Else
                    skippedCount = skippedCount + 1
                End If

            Case PARA_KIND_TOC, PARA_KIND_TABLE
                skippedCount = skippedCount + 1
        End Select

        completed = completed + 1

        If completed Mod 250 = 0 Then
            Application.StatusBar = _
                stepName & ": special paragraphs " & _
                Format$(completed, "#,##0") & _
                " / " & Format$(paraCount, "#,##0")
            DoEvents
        End If

    Next i

End Sub

Private Sub ApplyBodyRangeFormattingV35( _
                    ByVal targetRange As Range, _
                    ByVal styBody As Style)

    On Error GoTo RangeFallback

    targetRange.Style = styBody.NameLocal

    If RESET_DIRECT_PARAGRAPH_FORMATTING Then
        targetRange.ParagraphFormat.Reset
        targetRange.Style = styBody.NameLocal
    End If

    If ENFORCE_FONT_NAME_AND_SIZE Then
        EnforceFontNameAndSize targetRange, 0
    End If

    Exit Sub

RangeFallback:
    ' A damaged range may reject bulk formatting. Fall back only for
    ' that range, rather than making paragraph-by-paragraph processing
    ' the default for the whole document.
    On Error Resume Next
    targetRange.Style = styBody.NameLocal
    targetRange.ParagraphFormat.FirstLineIndent = _
        Application.CentimetersToPoints(0.74)
    EnforceFontNameAndSize targetRange, 0
    On Error GoTo 0

End Sub

Private Sub FormatAllTablesIndexedV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef formattedCount As Long, _
                    ByRef errorCount As Long, _
                    ByRef fallbackCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim tbl As Table

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each tbl In mainRange.Tables

        On Error GoTo TableError

        FormatOneTableIndexedV35 tbl, styBody, fallbackCount
        formattedCount = formattedCount + 1

        If formattedCount Mod 10 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(formattedCount, "#,##0") & _
                " tables formatted"
            DoEvents
        End If

ContinueTable:
        On Error GoTo 0
    Next tbl

    Exit Sub

TableError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueTable

End Sub

Private Sub FormatOneTableIndexedV35( _
                    ByVal tbl As Table, _
                    ByVal styBody As Style, _
                    ByRef fallbackCount As Long)

    Dim tableRange As Range
    Dim cellItem As Cell
    Dim cellCount As Long

    Set tableRange = tbl.Range.Duplicate

    tableRange.Style = styBody.NameLocal

    On Error Resume Next
    tbl.AllowAutoFit = True
    tbl.AutoFitBehavior wdAutoFitWindow
    tbl.Rows.LeftIndent = 0
    On Error GoTo 0

    SetRangeFontV10 _
        tableRange, FontFangSongGB2312Name(), "FangSong", 12

    ApplyTableRangeFormatIndexedV35 tableRange

    ' Always reinforce indentation at cell level.
    ' Range-level formatting is fast, while this single linear cell pass
    ' guarantees that the Body style cannot restore a first-line indent.
    fallbackCount = fallbackCount + 1

    For Each cellItem In tbl.Range.Cells
        ForceZeroCellIndentIndexedV35 cellItem.Range
        cellCount = cellCount + 1

        If cellCount Mod 500 = 0 Then DoEvents
    Next cellItem

End Sub

Private Sub ApplyTableRangeFormatIndexedV35( _
                    ByVal targetRange As Range)

    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 20
        .LeftIndent = 0
        .RightIndent = 0

        On Error Resume Next
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        On Error GoTo 0

        .FirstLineIndent = 0
        .DisableLineHeightGrid = True
    End With

End Sub

Private Function TableIndentNeedsFallbackV35( _
                    ByVal tableRange As Range) As Boolean

    Dim pointIndent As Single
    Dim characterIndent As Single

    On Error GoTo NeedsFallback

    pointIndent = tableRange.ParagraphFormat.FirstLineIndent
    characterIndent = _
        tableRange.ParagraphFormat.CharacterUnitFirstLineIndent

    If pointIndent <> 0 Or characterIndent <> 0 Then
        TableIndentNeedsFallbackV35 = True
    End If

    Exit Function

NeedsFallback:
    TableIndentNeedsFallbackV35 = True

End Function

Private Sub ForceZeroCellIndentIndexedV35(ByVal cellRange As Range)

    On Error Resume Next

    With cellRange.ParagraphFormat
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
    End With

    On Error GoTo 0

End Sub

Private Function NumberHeadingsAndIndexCaptionsV35( _
                    ByVal doc As Document, _
                    ByVal lt As ListTemplate, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef captionStarts() As Long, _
                    ByRef captionTypes() As Integer, _
                    ByRef captionSections() As String, _
                    ByRef captionOrdinals() As Long, _
                    ByRef headingCount As Long, _
                    ByRef numberingErrorCount As Long, _
                    ByRef level4AppliedCount As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByVal stepName As String) As Long

    Const CAPTION_GROW_BY As Long = 128

    Dim mainRange As Range
    Dim para As Paragraph
    Dim headingLevel As Integer
    Dim captionType As Integer
    Dim continuePrevious As Boolean
    Dim firstHeading As Boolean

    Dim currentH1 As String
    Dim currentH2 As String
    Dim currentSection As String
    Dim figureOrdinal As Long
    Dim tableOrdinal As Long

    Dim captionCapacity As Long
    Dim captionCount As Long
    Dim scannedCount As Long

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim h1Name As String
    Dim h2Name As String
    Dim h3Name As String
    Dim h4Name As String
    Dim figureStyleName As String
    Dim tableStyleName As String

    captionCapacity = CAPTION_GROW_BY

    ReDim captionStarts(1 To captionCapacity)
    ReDim captionTypes(1 To captionCapacity)
    ReDim captionSections(1 To captionCapacity)
    ReDim captionOrdinals(1 To captionCapacity)

    h1Name = styH1.NameLocal
    h2Name = styH2.NameLocal
    h3Name = styH3.NameLocal
    h4Name = styH4.NameLocal
    figureStyleName = styFigureCaption.NameLocal
    tableStyleName = styTableCaption.NameLocal

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    firstHeading = True
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not IsPositionInsideTocSequentialV35( _
                para.Range.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            If Not para.Range.Information(wdWithInTable) Then

                headingLevel = _
                    GetTargetHeadingLevelFastV35( _
                        para, h1Name, h2Name, h3Name, h4Name)

                If headingLevel > 0 Then

                    If headingLevel = 4 Then
                        On Error Resume Next
                        Err.Clear

                        para.Range.Style = styH4.NameLocal
                        ApplyLevel4DirectFormatV35 para.Range

                        If Err.Number = 0 Then
                            level4AppliedCount = level4AppliedCount + 1
                        Else
                            level4ErrorCount = level4ErrorCount + 1
                        End If

                        Err.Clear
                        On Error GoTo 0
                    End If

                    continuePrevious = Not firstHeading

                    If ApplyNumberingToOneParagraph( _
                        para, lt, headingLevel, continuePrevious) Then

                        firstHeading = False
                        headingCount = headingCount + 1

                        If headingLevel = 1 Then
                            currentH1 = _
                                NormalizeHeadingNumberForCaptionV35( _
                                    SafeListStringV35(para))
                            currentH2 = ""
                            currentSection = currentH1
                            figureOrdinal = 0
                            tableOrdinal = 0
                        ElseIf headingLevel = 2 Then
                            currentH2 = _
                                NormalizeHeadingNumberForCaptionV35( _
                                    SafeListStringV35(para))
                            currentSection = currentH2
                            figureOrdinal = 0
                            tableOrdinal = 0
                        End If
                    Else
                        numberingErrorCount = numberingErrorCount + 1
                    End If

                Else
                    captionType = GetCaptionTypeFastV35( _
                        para, figureStyleName, tableStyleName)

                    If captionType > 0 Then

                        captionCount = captionCount + 1

                        If captionCount > captionCapacity Then
                            captionCapacity = _
                                captionCapacity + CAPTION_GROW_BY

                            ReDim Preserve captionStarts( _
                                1 To captionCapacity)
                            ReDim Preserve captionTypes( _
                                1 To captionCapacity)
                            ReDim Preserve captionSections( _
                                1 To captionCapacity)
                            ReDim Preserve captionOrdinals( _
                                1 To captionCapacity)
                        End If

                        If Len(currentSection) = 0 Then
                            If Len(currentH2) > 0 Then
                                currentSection = currentH2
                            ElseIf Len(currentH1) > 0 Then
                                currentSection = currentH1
                            Else
                                currentSection = "0"
                            End If
                        End If

                        captionStarts(captionCount) = para.Range.Start
                        captionTypes(captionCount) = captionType
                        captionSections(captionCount) = currentSection

                        If captionType = 1 Then
                            figureOrdinal = figureOrdinal + 1
                            captionOrdinals(captionCount) = figureOrdinal
                        Else
                            tableOrdinal = tableOrdinal + 1
                            captionOrdinals(captionCount) = tableOrdinal
                        End If
                    End If
                End If
            End If
        End If

        If scannedCount Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; headings " & Format$(headingCount, "#,##0") & _
                "; captions " & Format$(captionCount, "#,##0")
            DoEvents
        End If

    Next para

    If captionCount > 0 Then
        ReDim Preserve captionStarts(1 To captionCount)
        ReDim Preserve captionTypes(1 To captionCount)
        ReDim Preserve captionSections(1 To captionCount)
        ReDim Preserve captionOrdinals(1 To captionCount)
    End If

    NumberHeadingsAndIndexCaptionsV35 = captionCount

End Function

Private Function GetTargetHeadingLevelFastV35( _
                    ByVal para As Paragraph, _
                    ByVal h1Name As String, _
                    ByVal h2Name As String, _
                    ByVal h3Name As String, _
                    ByVal h4Name As String) As Integer

    Dim sty As Style
    Dim nameValue As String

    On Error Resume Next
    Set sty = para.Range.Style
    On Error GoTo 0

    If sty Is Nothing Then Exit Function

    nameValue = sty.NameLocal

    If StrComp(nameValue, h1Name, vbTextCompare) = 0 Then
        GetTargetHeadingLevelFastV35 = 1
    ElseIf StrComp(nameValue, h2Name, vbTextCompare) = 0 Then
        GetTargetHeadingLevelFastV35 = 2
    ElseIf StrComp(nameValue, h3Name, vbTextCompare) = 0 Then
        GetTargetHeadingLevelFastV35 = 3
    ElseIf StrComp(nameValue, h4Name, vbTextCompare) = 0 Then
        GetTargetHeadingLevelFastV35 = 4
    End If

End Function

Private Function GetCaptionTypeFastV35( _
                    ByVal para As Paragraph, _
                    ByVal figureStyleName As String, _
                    ByVal tableStyleName As String) As Integer

    Dim sty As Style
    Dim styleName As String
    Dim textValue As String

    On Error Resume Next
    Set sty = para.Range.Style
    On Error GoTo 0

    If Not sty Is Nothing Then
        styleName = sty.NameLocal

        If StrComp( _
                styleName, figureStyleName, _
                vbTextCompare) = 0 Then

            GetCaptionTypeFastV35 = 1
            Exit Function
        End If

        If StrComp( _
                styleName, tableStyleName, _
                vbTextCompare) = 0 Then

            GetCaptionTypeFastV35 = 2
            Exit Function
        End If
    End If

    textValue = CleanParagraphTextV35(para.Range.Text)

    If StartsWithCaptionLabelV35(textValue, 1) Then
        GetCaptionTypeFastV35 = 1
    ElseIf StartsWithCaptionLabelV35(textValue, 2) Then
        GetCaptionTypeFastV35 = 2
    End If

End Function

Private Sub ProcessIndexedCaptionsV35( _
                    ByVal doc As Document, _
                    ByRef captionStarts() As Long, _
                    ByRef captionTypes() As Integer, _
                    ByRef captionSections() As String, _
                    ByRef captionOrdinals() As Long, _
                    ByVal captionCount As Long, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef figureCount As Long, _
                    ByRef tableCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim i As Long
    Dim workRange As Range
    Dim para As Paragraph

    ' V35 does not add, remove, replace or recalculate caption text.
    ' It only removes an inherited automatic list number and applies
    ' the requested Figure Caption / Table Caption formatting.
    For i = captionCount To 1 Step -1

        On Error GoTo CaptionError

        Set workRange = doc.Range( _
            Start:=captionStarts(i), _
            End:=captionStarts(i))
        Set para = workRange.Paragraphs(1)

        RemoveCaptionAutomaticNumberingV35 para

        If captionTypes(i) = 1 Then
            para.Range.Style = styFigureCaption.NameLocal
            ApplyCaptionDirectFormatV35 para.Range, 1
            figureCount = figureCount + 1
        Else
            para.Range.Style = styTableCaption.NameLocal
            ApplyCaptionDirectFormatV35 para.Range, 2
            tableCount = tableCount + 1
        End If

ContinueCaption:
        On Error GoTo 0

        If i Mod 50 = 0 Then
            Application.StatusBar = _
                stepName & ": " & _
                Format$(captionCount - i + 1, "#,##0") & _
                " / " & Format$(captionCount, "#,##0")
            DoEvents
        End If
    Next i

    Exit Sub

CaptionError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueCaption

End Sub

Private Sub RemoveCaptionAutomaticNumberingV35( _
                    ByVal para As Paragraph)

    Dim contentRange As Range
    Dim textValue As String
    Dim removeLength As Long

    On Error Resume Next

    ' Remove Word's live automatic/list number.
    para.Range.ListFormat.RemoveNumbers _
        NumberType:=wdNumberParagraph

    On Error GoTo 0

    Set contentRange = para.Range.Duplicate

    ' Exclude paragraph and table-end marks.
    Do While contentRange.End > contentRange.Start
        If Right$(contentRange.Text, 1) = Chr$(13) Or _
           Right$(contentRange.Text, 1) = Chr$(7) Then
            contentRange.MoveEnd wdCharacter, -1
        Else
            Exit Do
        End If
    Loop

    textValue = contentRange.Text
    removeLength = TypedCaptionListPrefixLengthV35(textValue)

    If removeLength > 0 Then
        contentRange.End = contentRange.Start + removeLength
        contentRange.Delete
    End If

    On Error Resume Next

    With para.Range.ParagraphFormat
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
    End With

    On Error GoTo 0

End Sub

Private Function TypedCaptionListPrefixLengthV35( _
                    ByVal textValue As String) As Long

    Dim i As Long
    Dim digitStart As Long
    Dim characterValue As String

    i = 1

    ' Skip spaces, quotes and bullet-like characters before the number.
    Do While i <= Len(textValue)
        characterValue = Mid$(textValue, i, 1)

        If IsCaptionPrefixLeadingCharacterV35(characterValue) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    digitStart = i

    Do While i <= Len(textValue)
        characterValue = Mid$(textValue, i, 1)

        If characterValue >= "0" And characterValue <= "9" Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    ' A leading list prefix must contain at least one digit.
    If i = digitStart Then Exit Function
    If i > Len(textValue) Then Exit Function

    characterValue = Mid$(textValue, i, 1)

    If Not IsCaptionListPunctuationV35(characterValue) Then
        Exit Function
    End If

    i = i + 1

    Do While i <= Len(textValue)
        characterValue = Mid$(textValue, i, 1)

        If IsCaptionWhitespaceV35(characterValue) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    ' Delete the prefix only when a real caption label follows it.
    If CaptionLabelStartsAtV35(textValue, i) Then
        TypedCaptionListPrefixLengthV35 = i - 1
    End If

End Function

Private Function IsCaptionPrefixLeadingCharacterV35( _
                    ByVal characterValue As String) As Boolean

    If IsCaptionWhitespaceV35(characterValue) Then
        IsCaptionPrefixLeadingCharacterV35 = True
        Exit Function
    End If

    Select Case AscW(characterValue)
        Case 34, 39, 183, 8216, 8217, 8220, 8221, 8226
            IsCaptionPrefixLeadingCharacterV35 = True
    End Select

End Function

Private Function IsCaptionWhitespaceV35( _
                    ByVal characterValue As String) As Boolean

    If characterValue = " " Or characterValue = vbTab Then
        IsCaptionWhitespaceV35 = True
        Exit Function
    End If

    Select Case AscW(characterValue)
        Case 160, 12288
            IsCaptionWhitespaceV35 = True
    End Select

End Function

Private Function IsCaptionListPunctuationV35( _
                    ByVal characterValue As String) As Boolean

    Select Case AscW(characterValue)
        Case 41, 46, 58, 12289, 12290, 65306, 65289
            IsCaptionListPunctuationV35 = True
    End Select

End Function

Private Function CaptionLabelStartsAtV35( _
                    ByVal textValue As String, _
                    ByVal startPosition As Long) As Boolean

    Dim remainingText As String
    Dim lowerText As String

    If startPosition < 1 Or startPosition > Len(textValue) Then
        Exit Function
    End If

    remainingText = Mid$(textValue, startPosition)

    If Left$(remainingText, 1) = ChrW(22270) Or _
       Left$(remainingText, 1) = ChrW(34920) Then
        CaptionLabelStartsAtV35 = True
        Exit Function
    End If

    lowerText = LCase$(remainingText)

    If Left$(lowerText, 6) = "figure" Or _
       Left$(lowerText, 5) = "table" Or _
       Left$(lowerText, 4) = "fig." Or _
       Left$(lowerText, 4) = "tab." Or _
       Left$(lowerText, 3) = "fig" Or _
       Left$(lowerText, 3) = "tab" Then
        CaptionLabelStartsAtV35 = True
    End If

End Function


Private Sub HideAllNonRequiredQuickStylesV35( _
                    ByVal doc As Document)

    Dim sty As Style
    Dim styleName As String

    For Each sty In doc.Styles

        styleName = sty.NameLocal

        If Not IsRequiredStyleNameV35(styleName) Then
            On Error Resume Next
            sty.QuickStyle = False
            sty.UnhideWhenUsed = False
            On Error GoTo 0
        End If

    Next sty

End Sub

Private Function IsRequiredStyleNameV35( _
                    ByVal styleName As String) As Boolean

    If StrComp(styleName, StyleBodyName(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleH1Name(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleH2Name(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleH3Name(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleH4Name(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleCaptionName(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleFigureCaptionName(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    ElseIf StrComp(styleName, StyleTableCaptionName(), vbTextCompare) = 0 Then
        IsRequiredStyleNameV35 = True
    End If

End Function

Private Function PublishAllRequiredStylesFastV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef captionStylesConfirmed As Long, _
                    ByRef stateReport As String) As Long

    Dim coreConfirmed As Long

    On Error Resume Next
    doc.FormattingShowFilter = wdShowFilterStylesAll
    doc.StyleSortMethod = wdStyleSortRecommended
    doc.FormattingShowUserStyleName = True
    doc.FormattingShowClear = True
    On Error GoTo 0

    HideAllNonRequiredQuickStylesV35 doc

    If PublishRequiredStyleV35(styH1, 1) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styH2, 2) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styH3, 3) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styH4, 4) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styCaption, 5) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styBody, 6) Then _
        coreConfirmed = coreConfirmed + 1

    If PublishRequiredStyleV35(styFigureCaption, 7) Then _
        captionStylesConfirmed = captionStylesConfirmed + 1

    If PublishRequiredStyleV35(styTableCaption, 8) Then _
        captionStylesConfirmed = captionStylesConfirmed + 1

    stateReport = _
        "Document styles: " & CStr(doc.Styles.Count) & _
        "; custom core styles: " & CStr(coreConfirmed) & _
        "; Quick Styles restricted to required custom styles" & _
        "; compatibility mode: " & CStr(doc.CompatibilityMode) & _
        "; save format: " & CStr(doc.SaveFormat)

    PublishAllRequiredStylesFastV35 = coreConfirmed

End Function

Private Sub AddStageTimingV35( _
                    ByRef reportText As String, _
                    ByVal stageName As String, _
                    ByVal startTime As Double)

    reportText = reportText & _
        stageName & ": " & _
        Format$(ElapsedSecondsV35(startTime), "0.00") & _
        " s" & vbCrLf

End Sub

Private Function ElapsedSecondsV35( _
                    ByVal startTime As Double) As Double

    Dim result As Double

    result = Timer - startTime

    If result < 0 Then result = result + 86400

    ElapsedSecondsV35 = result

End Function

Private Function CaptureParagraphMapFast( _
                    ByVal doc As Document, _
                    ByRef paraStarts() As Long, _
                    ByRef paraEnds() As Long, _
                    ByRef paraKinds() As Integer, _
                    ByVal stepName As String) As Long

    Const GROW_BY As Long = 2048
    Const PROGRESS_EVERY As Long = 100

    Dim mainRange As Range
    Dim para As Paragraph
    Dim paraRange As Range
    Dim styleCache As Object

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long

    Dim capacity As Long
    Dim count As Long

    capacity = GROW_BY

    ReDim paraStarts(1 To capacity)
    ReDim paraEnds(1 To capacity)
    ReDim paraKinds(1 To capacity)

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount

    Set styleCache = CreateObject("Scripting.Dictionary")
    styleCache.CompareMode = vbTextCompare

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' One linear pass through all paragraphs.
    For Each para In mainRange.Paragraphs

        count = count + 1

        If count > capacity Then
            capacity = capacity + GROW_BY
            ReDim Preserve paraStarts(1 To capacity)
            ReDim Preserve paraEnds(1 To capacity)
            ReDim Preserve paraKinds(1 To capacity)
        End If

        Set paraRange = para.Range.Duplicate

        paraStarts(count) = paraRange.Start
        paraEnds(count) = paraRange.End

        If PRESERVE_TABLES_OF_CONTENTS And _
           IsPositionInsideTableOfContents( _
               paraRange.Start, tocStarts, tocEnds, tocCount) Then

            paraKinds(count) = -1
        Else
            paraKinds(count) = _
                DetectParagraphKindFast(doc, para, styleCache)
        End If

        If count Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": " & Format$(count, "#,##0") & _
                " paragraphs scanned"
            DoEvents
        End If

    Next para

    If count > 0 Then
        ReDim Preserve paraStarts(1 To count)
        ReDim Preserve paraEnds(1 To count)
        ReDim Preserve paraKinds(1 To count)
    End If

    Application.StatusBar = _
        stepName & ": " & Format$(count, "#,##0") & _
        " paragraphs scanned"

    CaptureParagraphMapFast = count

End Function

Private Sub BuildTableOfContentsBoundaries( _
                    ByVal doc As Document, _
                    ByRef tocStarts() As Long, _
                    ByRef tocEnds() As Long, _
                    ByRef tocCount As Long)

    Dim toc As TableOfContents
    Dim index As Long

    tocCount = doc.TablesOfContents.Count
    If tocCount = 0 Then Exit Sub

    ReDim tocStarts(1 To tocCount)
    ReDim tocEnds(1 To tocCount)

    For Each toc In doc.TablesOfContents
        index = index + 1
        tocStarts(index) = toc.Range.Start
        tocEnds(index) = toc.Range.End
    Next toc

End Sub

Private Function IsPositionInsideTableOfContents( _
                    ByVal position As Long, _
                    ByRef tocStarts() As Long, _
                    ByRef tocEnds() As Long, _
                    ByVal tocCount As Long) As Boolean

    Dim i As Long

    For i = 1 To tocCount
        If position >= tocStarts(i) And position < tocEnds(i) Then
            IsPositionInsideTableOfContents = True
            Exit Function
        End If
    Next i

End Function

Private Function DetectParagraphKindFast( _
                    ByVal doc As Document, _
                    ByVal para As Paragraph, _
                    ByVal styleCache As Object) As Integer

    Dim sty As Style
    Dim styleKey As String
    Dim cachedKind As Integer
    Dim outlineLevel As WdOutlineLevel

    On Error Resume Next
    Set sty = para.Range.Style
    On Error GoTo 0

    If sty Is Nothing Then
        DetectParagraphKindFast = 0
        Exit Function
    End If

    styleKey = sty.NameLocal

    If styleCache.Exists(styleKey) Then
        cachedKind = CInt(styleCache(styleKey))
    Else
        cachedKind = DetectStyleKindFast(doc, sty)
        styleCache.Add styleKey, cachedKind
    End If

    ' Direct paragraph outline levels are checked only when the
    ' paragraph style itself was not identified as a heading.
    If cachedKind = 0 Then

        ' A level-4 heading is often imported as body text while retaining
        ' either list level 4 or a typed prefix such as 1.2.3.4.
        If ExistingListLevelV35(para) = 4 Or _
           LooksLikeLevel4HeadingV35(para.Range.Text) Then

            DetectParagraphKindFast = 4
            Exit Function
        End If

        On Error Resume Next
        outlineLevel = para.OutlineLevel
        On Error GoTo 0

        Select Case outlineLevel
            Case wdOutlineLevel1
                DetectParagraphKindFast = 1
            Case wdOutlineLevel2
                DetectParagraphKindFast = 2
            Case wdOutlineLevel3
                DetectParagraphKindFast = 3
            Case wdOutlineLevel4
                DetectParagraphKindFast = 4
            Case Else
                DetectParagraphKindFast = 0
        End Select
    Else
        DetectParagraphKindFast = cachedKind
    End If

End Function

Private Function ExistingListLevelV35( _
                    ByVal para As Paragraph) As Integer

    On Error Resume Next

    If para.Range.ListFormat.ListType <> wdListNoNumbering Then
        ExistingListLevelV35 = _
            CInt(para.Range.ListFormat.ListLevelNumber)
    End If

    On Error GoTo 0

End Function

Private Function LooksLikeLevel4HeadingV35( _
                    ByVal textValue As String) As Boolean

    Static regexObject As Object

    On Error GoTo SafeExit

    If regexObject Is Nothing Then
        Set regexObject = CreateObject("VBScript.RegExp")
        regexObject.Global = False
        regexObject.IgnoreCase = True
        regexObject.Pattern = BuildHeadingPrefixPattern(4)
    End If

    LooksLikeLevel4HeadingV35 = regexObject.Test(textValue)

SafeExit:
End Function

Private Function DetectStyleKindFast(ByVal doc As Document, _
                                     ByVal sty As Style) As Integer

    Dim styleName As String
    Dim outlineLevel As WdOutlineLevel

    styleName = NormalizeStyleName(sty.NameLocal)

    If styleName = NormalizeStyleName(StyleH1Name()) Or _
       IsBuiltInStyle(doc, sty, wdStyleHeading1) Or _
       IsCommonHeadingName(styleName, 1) Then
        DetectStyleKindFast = 1
        Exit Function
    End If

    If styleName = NormalizeStyleName(StyleH2Name()) Or _
       IsBuiltInStyle(doc, sty, wdStyleHeading2) Or _
       IsCommonHeadingName(styleName, 2) Then
        DetectStyleKindFast = 2
        Exit Function
    End If

    If styleName = NormalizeStyleName(StyleH3Name()) Or _
       IsBuiltInStyle(doc, sty, wdStyleHeading3) Or _
       IsCommonHeadingName(styleName, 3) Then
        DetectStyleKindFast = 3
        Exit Function
    End If

    If styleName = NormalizeStyleName(StyleH4Name()) Or _
       IsBuiltInStyle(doc, sty, wdStyleHeading4) Or _
       IsCommonHeadingName(styleName, 4) Then
        DetectStyleKindFast = 4
        Exit Function
    End If

    If styleName = NormalizeStyleName(StyleCaptionName()) Or _
       IsBuiltInStyle(doc, sty, wdStyleCaption) Or _
       IsCommonCaptionName(styleName) Then
        DetectStyleKindFast = 5
        Exit Function
    End If

    On Error Resume Next
    outlineLevel = sty.ParagraphFormat.OutlineLevel
    On Error GoTo 0

    Select Case outlineLevel
        Case wdOutlineLevel1
            DetectStyleKindFast = 1
        Case wdOutlineLevel2
            DetectStyleKindFast = 2
        Case wdOutlineLevel3
            DetectStyleKindFast = 3
        Case wdOutlineLevel4
            DetectStyleKindFast = 4
        Case Else
            DetectStyleKindFast = 0
    End Select

End Function

Private Sub NormalizeParagraphMapBottomUp( _
                    ByVal doc As Document, _
                    ByRef paraStarts() As Long, _
                    ByRef paraEnds() As Long, _
                    ByRef paraKinds() As Integer, _
                    ByVal paraCount As Long, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByRef processedCount As Long, _
                    ByRef skippedCount As Long, _
                    ByVal stepName As String)

    Const PROGRESS_EVERY As Long = 100

    Dim i As Long
    Dim completed As Long
    Dim workRange As Range
    Dim para As Paragraph

    For i = paraCount To 1 Step -1

        completed = completed + 1

        If paraKinds(i) = -1 Then
            skippedCount = skippedCount + 1
        Else
            Set workRange = Nothing
            Set para = Nothing

            On Error Resume Next
            Set workRange = doc.Range( _
                Start:=paraStarts(i), _
                End:=paraEnds(i))
            Set para = workRange.Paragraphs(1)
            On Error GoTo 0

            If para Is Nothing Then
                skippedCount = skippedCount + 1
            ElseIf NormalizeOneParagraph( _
                    para, paraKinds(i), _
                    styBody, styH1, styH2, styH3, styH4, styCaption) Then
                processedCount = processedCount + 1
            Else
                skippedCount = skippedCount + 1
            End If
        End If

        If completed Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": " & Format$(completed, "#,##0") & _
                " / " & Format$(paraCount, "#,##0")
            DoEvents
        End If

    Next i

End Sub

Private Function NormalizeOneParagraph(ByVal para As Paragraph, _
                                       ByVal paragraphKind As Integer, _
                                       ByVal styBody As Style, _
                                       ByVal styH1 As Style, _
                                       ByVal styH2 As Style, _
                                       ByVal styH3 As Style, _
                                       ByVal styH4 As Style, _
                                       ByVal styCaption As Style) As Boolean

    Dim targetStyle As Style
    Dim headingLevel As Integer

    On Error GoTo ParagraphError

    Select Case paragraphKind
        Case 1
            Set targetStyle = styH1
            headingLevel = 1
        Case 2
            Set targetStyle = styH2
            headingLevel = 2
        Case 3
            Set targetStyle = styH3
            headingLevel = 3
        Case 4
            Set targetStyle = styH4
            headingLevel = 4
        Case 5
            Set targetStyle = styCaption
        Case Else
            Set targetStyle = styBody
    End Select

    If headingLevel > 0 Then
        ' Remove old automatic numbering first.
        On Error Resume Next
        para.Range.ListFormat.RemoveNumbers NumberType:=wdNumberParagraph
        On Error GoTo ParagraphError

        ' Remove manually typed numbering to prevent:
        ' automatic 1.1 + typed 1.1 = duplicated numbering.
        If REMOVE_TYPED_HEADING_NUMBERS Then
            StripTypedHeadingPrefix para, headingLevel
        End If
    End If

    para.Range.Style = targetStyle.NameLocal

    If RESET_DIRECT_PARAGRAPH_FORMATTING Then
        para.Range.ParagraphFormat.Reset
        para.Range.Style = targetStyle.NameLocal
    End If

    ' Removing numbers again is intentional. An old style can still be
    ' linked to an old list template. New numbering is applied later.
    If headingLevel > 0 Then
        On Error Resume Next
        para.Range.ListFormat.RemoveNumbers NumberType:=wdNumberParagraph
        On Error GoTo ParagraphError
    End If

    If ENFORCE_FONT_NAME_AND_SIZE Then
        EnforceFontNameAndSize para.Range, paragraphKind
    End If

    NormalizeOneParagraph = True
    Exit Function

ParagraphError:
    NormalizeOneParagraph = False

End Function

Private Sub EnforceFontNameAndSize(ByVal rng As Range, _
                                   ByVal paragraphKind As Integer)

    Dim farEastPreferred As String
    Dim farEastFallback As String
    Dim fontSize As Single

    Select Case paragraphKind
        Case 1
            farEastPreferred = FontHeiTiName()
            farEastFallback = "SimHei"
            fontSize = 18
        Case 2
            farEastPreferred = FontHeiTiName()
            farEastFallback = "SimHei"
            fontSize = 16
        Case 3, 4
            farEastPreferred = FontHeiTiName()
            farEastFallback = "SimHei"
            fontSize = 15
        Case 5
            farEastPreferred = FontHeiTiName()
            farEastFallback = "SimHei"
            fontSize = 12
        Case Else
            farEastPreferred = FontFangSongGB2312Name()
            farEastFallback = "FangSong"
            fontSize = 14
    End Select

    On Error Resume Next

    Err.Clear
    rng.Font.NameFarEast = farEastPreferred

    If Err.Number <> 0 Then
        Err.Clear
        rng.Font.NameFarEast = farEastFallback
    End If

    Err.Clear
    rng.Font.NameAscii = EN_FONT
    rng.Font.NameOther = EN_FONT
    rng.Font.NameBi = EN_FONT
    rng.Font.Size = fontSize

    On Error GoTo 0

End Sub

Private Sub FormatAllTablesV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef formattedCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Const PROGRESS_EVERY As Long = 5

    Dim mainRange As Range
    Dim tbl As Table

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' FAST MODE:
    ' - no table-by-table Selection changes;
    ' - no paragraph-by-paragraph font loop;
    ' - no three-pass paragraph verification loop.
    For Each tbl In mainRange.Tables

        On Error GoTo TableError

        Application.StatusBar = _
            stepName & ": formatting table " & _
            Format$(formattedCount + 1, "#,##0")

        FormatOneTableFastV35 tbl, styBody
        formattedCount = formattedCount + 1

        If formattedCount Mod PROGRESS_EVERY = 0 Then
            DoEvents
        End If

ContinueTable:
        On Error GoTo 0
    Next tbl

    Exit Sub

TableError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueTable

End Sub

Private Sub FormatOneTableFastV35(ByVal tbl As Table, _
                                  ByVal styBody As Style)

    Dim tableRange As Range
    Dim cellItem As Cell
    Dim processedCells As Long

    Set tableRange = tbl.Range.Duplicate

    ' Apply the real Body paragraph style first.
    ' Table-specific direct formatting is applied immediately afterward,
    ' so the Body style's two-character first-line indent is overridden.
    tableRange.Style = styBody.NameLocal

    ' Table structure settings are optional because imported or merged
    ' tables may reject one of these properties.
    On Error Resume Next
    tbl.AllowAutoFit = True
    tbl.AutoFitBehavior wdAutoFitWindow
    tbl.Rows.LeftIndent = 0
    Err.Clear
    On Error GoTo 0

    ' Apply font once to the complete table range.
    SetRangeFontV10 _
        tableRange, FontFangSongGB2312Name(), "FangSong", 12

    ' Apply all paragraph settings once to the complete table range.
    ApplyTableRangeFormatFastV35 tableRange

    ' Reinforce only indentation at cell level. This is substantially
    ' faster than selecting every table or looping through every paragraph,
    ' while still clearing Chinese character-unit indentation.
    For Each cellItem In tbl.Range.Cells

        ForceZeroCellIndentFastV35 cellItem.Range

        processedCells = processedCells + 1

        ' Keep Word responsive in very large tables.
        If processedCells Mod 100 = 0 Then DoEvents
    Next cellItem

End Sub

Private Sub ApplyTableRangeFormatFastV35(ByVal targetRange As Range)

    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 20

        .LeftIndent = 0
        .RightIndent = 0

        ' Clear both character-unit and point-based indentation.
        On Error Resume Next
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        Err.Clear
        On Error GoTo 0

        .FirstLineIndent = 0
        .DisableLineHeightGrid = True
    End With

End Sub

Private Sub ForceZeroCellIndentFastV35(ByVal cellRange As Range)

    On Error Resume Next

    With cellRange.ParagraphFormat
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
    End With

    Err.Clear
    On Error GoTo 0

End Sub

' Fast table-only repair.
' It does not rebuild headings, numbering, pictures, or page setup.
Private Sub RepairAllTableIndent_V35()

    ' Compatibility alias.
    RepairTablesOnly_V35

End Sub

' Select the text of the table that contains the cursor.
' If the cursor is not in a table, select the next table in the document;
' if there is no later table, select the first table.
Private Sub SelectCurrentOrNextTableText_V35()

    Dim doc As Document
    Dim tbl As Table
    Dim cursorPosition As Long
    Dim foundTable As Boolean
    Dim targetRange As Range

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument
    cursorPosition = Selection.Range.Start

    If Selection.Information(wdWithInTable) Then
        Set tbl = Selection.Tables(1)
        foundTable = True
    Else
        For Each tbl In doc.Tables
            If tbl.Range.Start >= cursorPosition Then
                foundTable = True
                Exit For
            End If
        Next tbl

        If Not foundTable And doc.Tables.Count > 0 Then
            Set tbl = doc.Tables(1)
            foundTable = True
        End If
    End If

    If Not foundTable Then
        MsgBox "No table was found in the document.", vbInformation
        Exit Sub
    End If

    Set targetRange = tbl.Range.Duplicate
    targetRange.Select

End Sub

' Apply the required settings to one table and keep it selected so the
' user can continue adjusting it manually in the Word Ribbon.
Private Sub FormatCurrentTableText_V35()

    Dim doc As Document
    Dim tbl As Table
    Dim styBody As Style

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If Not Selection.Information(wdWithInTable) Then
        SelectCurrentOrNextTableText_V35
    End If

    If Not Selection.Information(wdWithInTable) Then Exit Sub

    Set tbl = Selection.Tables(1)
    Set styBody = EnsureParagraphStyle(doc, StyleBodyName())
    ConfigureBodyStyle doc, styBody

    FormatOneTableFastV35 tbl, styBody

    ' Selection is used only here because the user explicitly requested
    ' the table text to remain selected for further manual settings.
    tbl.Range.Select

End Sub

Private Sub FormatAllPicturesV10( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByRef inlineCount As Long, _
                    ByRef floatingCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Const PROGRESS_EVERY As Long = 25

    Dim mainRange As Range
    Dim ils As InlineShape
    Dim shp As Shape
    Dim pictureParagraph As Paragraph
    Dim totalDone As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' Inline pictures are centered by centering their paragraph.
    For Each ils In mainRange.InlineShapes

        On Error GoTo InlinePictureError

        Set pictureParagraph = ils.Range.Paragraphs(1)

        If ParagraphIsObjectOnlyV10(pictureParagraph) Then
            pictureParagraph.Range.Style = styBody.NameLocal
            RemoveParagraphNumberingV10 pictureParagraph
        End If

        FormatPictureParagraphV10 pictureParagraph

        inlineCount = inlineCount + 1
        totalDone = totalDone + 1

        If totalDone Mod PROGRESS_EVERY = 0 Then
            Application.StatusBar = _
                stepName & ": " & Format$(totalDone, "#,##0") & _
                " picture objects formatted"
            DoEvents
        End If

ContinueInlinePicture:
        On Error GoTo 0
    Next ils

    ' Floating pictures must be centered as Shape objects.
    For Each shp In doc.Shapes

        If IsPictureShapeV10(shp) Then

            On Error GoTo FloatingPictureError

            ' Center the floating object relative to the page margins.
            On Error Resume Next
            shp.RelativeHorizontalPosition = _
                wdRelativeHorizontalPositionMargin
            shp.Left = wdShapeCenter
            On Error GoTo FloatingPictureError

            Set pictureParagraph = shp.Anchor.Paragraphs(1)

            If ParagraphIsObjectOnlyV10(pictureParagraph) Then
                pictureParagraph.Range.Style = styBody.NameLocal
                RemoveParagraphNumberingV10 pictureParagraph
            End If

            ' Always remove indentation from the picture anchor paragraph.
            FormatPictureParagraphV10 pictureParagraph

            floatingCount = floatingCount + 1
            totalDone = totalDone + 1

            If totalDone Mod PROGRESS_EVERY = 0 Then
                Application.StatusBar = _
                    stepName & ": " & Format$(totalDone, "#,##0") & _
                    " picture objects formatted"
                DoEvents
            End If
        End If

ContinueFloatingPicture:
        On Error GoTo 0
    Next shp

    Exit Sub

InlinePictureError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueInlinePicture

FloatingPictureError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueFloatingPicture

End Sub

Private Sub FormatPictureParagraphV10(ByVal para As Paragraph)

    With para.Range.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .SpaceBefore = 0
        .SpaceAfter = 0
        .LineSpacingRule = wdLineSpaceSingle
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
        .DisableLineHeightGrid = True
    End With

End Sub

Private Sub RemoveParagraphNumberingV10(ByVal para As Paragraph)

    On Error Resume Next
    para.Range.ListFormat.RemoveNumbers NumberType:=wdNumberParagraph
    On Error GoTo 0

End Sub

Private Function ParagraphIsObjectOnlyV10( _
                    ByVal para As Paragraph) As Boolean

    Dim textValue As String

    textValue = para.Range.Text

    textValue = Replace(textValue, Chr$(13), "")
    textValue = Replace(textValue, Chr$(7), "")
    textValue = Replace(textValue, Chr$(1), "")
    textValue = Replace(textValue, vbTab, "")
    textValue = Replace(textValue, " ", "")
    textValue = Replace(textValue, ChrW(160), "")
    textValue = Replace(textValue, ChrW(12288), "")

    ParagraphIsObjectOnlyV10 = (Len(textValue) = 0)

End Function

Private Function IsPictureShapeV10(ByVal shp As Shape) As Boolean

    Select Case shp.Type
        Case msoPicture, msoLinkedPicture
            IsPictureShapeV10 = True
        Case Else
            IsPictureShapeV10 = False
    End Select

End Function

Private Sub SetRangeFontV10( _
                    ByVal targetRange As Range, _
                    ByVal preferredFarEastFont As String, _
                    ByVal fallbackFarEastFont As String, _
                    ByVal fontSize As Single)

    On Error Resume Next

    Err.Clear
    targetRange.Font.NameFarEast = preferredFarEastFont

    If Err.Number <> 0 Then
        Err.Clear
        targetRange.Font.NameFarEast = fallbackFarEastFont
    End If

    Err.Clear
    targetRange.Font.NameAscii = EN_FONT
    targetRange.Font.NameOther = EN_FONT
    targetRange.Font.NameBi = EN_FONT
    targetRange.Font.Size = fontSize

    ' Bold, italic, underline, superscript and text color are preserved.
    On Error GoTo 0

End Sub

Private Function CreateCompatibleListTemplate( _
                    ByVal doc As Document, _
                    ByRef stepName As String) As ListTemplate

    Dim lt As ListTemplate
    Dim firstErrorNumber As Long
    Dim firstErrorDescription As String

    ' The Name argument is intentionally omitted.
    ' Some Word installations raise error 5 when a generated list-template
    ' name is too long or is not accepted as a LISTNUM-compatible name.
    stepName = "Creating multilevel numbering: adding unnamed template"
    Application.StatusBar = stepName & "..."

    On Error Resume Next

    ' Method 1: positional Boolean argument. This matches the simplest
    ' form supported by older and newer Word VBA versions.
    Err.Clear
    Set lt = doc.ListTemplates.Add(True)

    If lt Is Nothing Then
        firstErrorNumber = Err.Number
        firstErrorDescription = Err.Description

        ' Method 2: named argument, as documented by Microsoft.
        Err.Clear
        Set lt = doc.ListTemplates.Add(OutlineNumbered:=True)
    End If

    If lt Is Nothing Then
        ' Method 3: create an unnamed template, then mark it as outline.
        Err.Clear
        Set lt = doc.ListTemplates.Add

        If Not lt Is Nothing Then
            Err.Clear
            lt.OutlineNumbered = True

            If Err.Number <> 0 Then
                Set lt = Nothing
            End If
        End If
    End If

    On Error GoTo 0

    If lt Is Nothing Then
        If firstErrorNumber = 0 Then firstErrorNumber = vbObjectError + 2801
        If Len(firstErrorDescription) = 0 Then
            firstErrorDescription = _
                "Word could not create a document-level outline list template."
        End If

        Err.Raise firstErrorNumber, _
                  "CreateCompatibleListTemplate", _
                  firstErrorDescription
    End If

    Set CreateCompatibleListTemplate = lt

End Function


Private Sub ConfigureMultilevelListAllLevelsV35( _
                    ByVal lt As ListTemplate, _
                    ByRef stepName As String)

    ' Exactly two ordinary spaces follow every number:
    ' 1) NumberFormat ends with one ordinary space;
    ' 2) TrailingCharacter = wdTrailingSpace adds the second one.
    '
    ' Visible examples:
    '   1.  Heading
    '   1.1  Heading
    '   1.1.1  Heading
    '   1.1.1.1  Heading

    ConfigureOneListLevelSafe _
        lt.ListLevels(1), "%1. ", 1, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(2), "%1.%2 ", 2, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(3), "%1.%2.%3 ", 3, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(4), "%1.%2.%3.%4 ", 4, stepName

End Sub

Private Sub ConfigureMultilevelListSafe( _
                    ByVal lt As ListTemplate, _
                    ByRef stepName As String)

    ' One literal ordinary space is stored in NumberFormat.
    ' TrailingCharacter adds one more ordinary space.
    ' The visible result is therefore two spaces after the number.
    ConfigureOneListLevelSafe _
        lt.ListLevels(1), "%1. ", 1, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(2), "%1.%2 ", 2, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(3), "%1.%2.%3 ", 3, stepName

    ConfigureOneListLevelSafe _
        lt.ListLevels(4), "%1.%2.%3.%4 ", 4, stepName

End Sub

Private Sub ConfigureOneListLevelSafe( _
                    ByVal levelObject As ListLevel, _
                    ByVal numberFormat As String, _
                    ByVal levelNumber As Integer, _
                    ByRef stepName As String)

    Dim savedErrorNumber As Long
    Dim savedErrorDescription As String

    On Error GoTo LevelError

    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " NumberStyle"
    Application.StatusBar = stepName & "..."
    levelObject.NumberStyle = wdListNumberStyleArabic

    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " NumberFormat"
    Application.StatusBar = stepName & "..."
    levelObject.NumberFormat = numberFormat

    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " StartAt"
    levelObject.StartAt = 1

    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " ResetOnHigher"

    If levelNumber = 1 Then
        ' Microsoft documents False for level 1.
        levelObject.ResetOnHigher = False
    Else
        levelObject.ResetOnHigher = levelNumber - 1
    End If

    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " trailing space"
    levelObject.TrailingCharacter = wdTrailingSpace

    ' The following values affect visual alignment only. Word versions and
    ' damaged imported list templates sometimes reject one of these values.
    ' They are optional and must never stop the entire document conversion.
    stepName = "Creating multilevel numbering: level " & _
               CStr(levelNumber) & " optional alignment"

    On Error Resume Next
    Err.Clear
    levelObject.Alignment = wdListLevelAlignLeft

    Err.Clear
    levelObject.NumberPosition = 0

    Err.Clear
    levelObject.TextPosition = 0

    Err.Clear
    levelObject.TabPosition = wdUndefined
    On Error GoTo LevelError

    Exit Sub

LevelError:
    savedErrorNumber = Err.Number
    savedErrorDescription = Err.Description

    Err.Raise savedErrorNumber, _
              "ConfigureOneListLevelSafe", _
              savedErrorDescription

End Sub

Private Sub ApplyHeadingNumberingFast( _
                    ByVal doc As Document, _
                    ByVal lt As ListTemplate, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByRef headingCount As Long, _
                    ByRef errorCount As Long, _
                    ByRef level4AppliedCount As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByVal stepName As String)

    Const PROGRESS_EVERY As Long = 50

    Dim mainRange As Range
    Dim para As Paragraph
    Dim headingLevel As Integer
    Dim firstHeading As Boolean
    Dim continuePrevious As Boolean

    firstHeading = True
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    ' One top-to-bottom scan after style normalization.
    For Each para In mainRange.Paragraphs

        headingLevel = GetTargetHeadingLevel( _
            para, styH1, styH2, styH3, styH4)

        If headingLevel > 0 Then

            ' Force Style 4 during this existing heading scan.
            ' This avoids a second whole-document H4 scan.
            If headingLevel = 4 Then
                On Error Resume Next
                Err.Clear

                para.Range.Style = styH4.NameLocal
                ApplyLevel4DirectFormatV35 para.Range

                If Err.Number = 0 Then
                    level4AppliedCount = level4AppliedCount + 1
                Else
                    level4ErrorCount = level4ErrorCount + 1
                End If

                Err.Clear
                On Error GoTo 0
            End If

            continuePrevious = Not firstHeading

            If ApplyNumberingToOneParagraph( _
                para, lt, headingLevel, continuePrevious) Then

                firstHeading = False
                headingCount = headingCount + 1
            Else
                errorCount = errorCount + 1
            End If

            If headingCount > 0 And _
               headingCount Mod PROGRESS_EVERY = 0 Then

                Application.StatusBar = _
                    stepName & ": " & _
                    Format$(headingCount, "#,##0") & _
                    " headings numbered"
                DoEvents
            End If
        End If

    Next para

End Sub

Private Function GetTargetHeadingLevel( _
                    ByVal para As Paragraph, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style) As Integer

    Dim sty As Style
    Dim styleName As String

    On Error Resume Next
    Set sty = para.Range.Style
    On Error GoTo 0

    If sty Is Nothing Then Exit Function

    styleName = NormalizeStyleName(sty.NameLocal)

    If styleName = NormalizeStyleName(styH1.NameLocal) Then
        GetTargetHeadingLevel = 1
    ElseIf styleName = NormalizeStyleName(styH2.NameLocal) Then
        GetTargetHeadingLevel = 2
    ElseIf styleName = NormalizeStyleName(styH3.NameLocal) Then
        GetTargetHeadingLevel = 3
    ElseIf styleName = NormalizeStyleName(styH4.NameLocal) Then
        GetTargetHeadingLevel = 4
    End If

End Function

Private Function ApplyNumberingToOneParagraph( _
                    ByVal para As Paragraph, _
                    ByVal lt As ListTemplate, _
                    ByVal headingLevel As Integer, _
                    ByVal continuePrevious As Boolean) As Boolean

    On Error GoTo NumberingError

    para.Range.ListFormat.ApplyListTemplateWithLevel _
        ListTemplate:=lt, _
        ContinuePreviousList:=continuePrevious, _
        ApplyTo:=wdListApplyToSelection, _
        DefaultListBehavior:=wdWord10ListBehavior, _
        ApplyLevel:=headingLevel

    ApplyNumberingToOneParagraph = True
    Exit Function

NumberingError:
    ApplyNumberingToOneParagraph = False

End Function

Private Sub TryLinkStylesToListTemplate(ByVal lt As ListTemplate, _
                                        ByVal styH1 As Style, _
                                        ByVal styH2 As Style, _
                                        ByVal styH3 As Style, _
                                        ByVal styH4 As Style)

    TryLinkOneHeadingStyleV35 lt, styH1, 1
    TryLinkOneHeadingStyleV35 lt, styH2, 2
    TryLinkOneHeadingStyleV35 lt, styH3, 3
    TryLinkOneHeadingStyleV35 lt, styH4, 4

End Sub

Private Sub TryLinkOneHeadingStyleV35( _
                    ByVal lt As ListTemplate, _
                    ByVal sty As Style, _
                    ByVal levelNumber As Integer)

    If sty Is Nothing Then Exit Sub

    On Error Resume Next

    ' Use both supported linking routes. Some Word builds accept one
    ' while silently ignoring the other for custom level-4 styles.
    sty.LinkToListTemplate _
        ListTemplate:=lt, _
        ListLevelNumber:=levelNumber

    Err.Clear
    lt.ListLevels(levelNumber).LinkedStyle = sty.NameLocal

    Err.Clear
    On Error GoTo 0

End Sub

Private Sub EnsureLevel4HeadingStylesV35( _
                    ByVal doc As Document, _
                    ByVal lt As ListTemplate, _
                    ByVal styH4 As Style, _
                    ByRef repairedCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Const PROGRESS_EVERY As Long = 25

    Dim mainRange As Range
    Dim para As Paragraph
    Dim currentStyle As Style
    Dim currentStyleName As String
    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim scannedParagraphs As Long

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedParagraphs = scannedParagraphs + 1

        If scannedParagraphs Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedParagraphs, "#,##0") & _
                " paragraphs; repaired " & _
                Format$(repairedCount, "#,##0")
            DoEvents
        End If

        If Not para.Range.Information(wdWithInTable) Then
            If Not IsPositionInsideTableOfContents( _
                    para.Range.Start, tocStarts, tocEnds, tocCount) Then

                If IsLevel4HeadingParagraphV35(doc, para, styH4) Then

                    On Error GoTo Level4Error

                    Set currentStyle = Nothing
                    currentStyleName = ""

                    On Error Resume Next
                    Set currentStyle = para.Range.Style
                    If Not currentStyle Is Nothing Then
                        currentStyleName = _
                            NormalizeStyleName(currentStyle.NameLocal)
                    End If
                    On Error GoTo Level4Error

                    If currentStyleName <> _
                       NormalizeStyleName(styH4.NameLocal) Then

                        If LooksLikeLevel4HeadingV35(para.Range.Text) Then
                            If Not lt Is Nothing Then
                                StripTypedHeadingPrefix para, 4
                            End If
                        End If

                        para.Range.Style = styH4.NameLocal
                        repairedCount = repairedCount + 1
                    End If

                    ApplyLevel4DirectFormatV35 para.Range

                    If ExistingListLevelV35(para) <> 4 Then
                        If Not lt Is Nothing Then
                            If Not ApplyNumberingToOneParagraph( _
                                    para, lt, 4, True) Then
                                errorCount = errorCount + 1
                            End If
                        End If
                    End If

                    If repairedCount > 0 And _
                       repairedCount Mod PROGRESS_EVERY = 0 Then

                        Application.StatusBar = _
                            stepName & ": " & _
                            Format$(repairedCount, "#,##0") & _
                            " level-4 headings repaired"
                        DoEvents
                    End If
                End If
            End If
        End If

ContinueLevel4:
        On Error GoTo 0
    Next para

    Exit Sub

Level4Error:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueLevel4

End Sub

Private Function IsLevel4HeadingParagraphV35( _
                    ByVal doc As Document, _
                    ByVal para As Paragraph, _
                    ByVal styH4 As Style) As Boolean

    Dim sty As Style
    Dim normalizedName As String
    Dim outlineLevel As WdOutlineLevel

    On Error Resume Next
    Set sty = para.Range.Style
    On Error GoTo 0

    If Not sty Is Nothing Then
        normalizedName = NormalizeStyleName(sty.NameLocal)

        If normalizedName = NormalizeStyleName(styH4.NameLocal) Or _
           IsBuiltInStyle(doc, sty, wdStyleHeading4) Or _
           IsCommonHeadingName(normalizedName, 4) Then

            IsLevel4HeadingParagraphV35 = True
            Exit Function
        End If
    End If

    If ExistingListLevelV35(para) = 4 Then
        IsLevel4HeadingParagraphV35 = True
        Exit Function
    End If

    On Error Resume Next
    outlineLevel = para.OutlineLevel
    On Error GoTo 0

    If outlineLevel = wdOutlineLevel4 Then
        IsLevel4HeadingParagraphV35 = True
        Exit Function
    End If

    IsLevel4HeadingParagraphV35 = _
        LooksLikeLevel4HeadingV35(para.Range.Text)

End Function

Private Sub ApplyLevel4DirectFormatV35(ByVal targetRange As Range)

    SetRangeFontV10 _
        targetRange, FontHeiTiName(), "SimHei", 15

    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevel4
        .Alignment = wdAlignParagraphLeft
        .SpaceBefore = 6
        .SpaceAfter = 6
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 24
        .LeftIndent = 0
        .RightIndent = 0
        .FirstLineIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .DisableLineHeightGrid = True
        .KeepWithNext = True
        .KeepTogether = True
    End With

End Sub

Private Sub FormatAndRenumberCaptionsV35( _
                    ByVal doc As Document, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef figureCount As Long, _
                    ByRef tableCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    ' Compatibility wrapper only. V35 never creates caption numbers.
    FormatCaptionsOnlyV35 _
        doc, styFigureCaption, styTableCaption, _
        figureCount, tableCount, errorCount, stepName

End Sub

Private Sub UpdateCaptionFieldsOnlyV35(ByVal doc As Document)

    ' Intentionally empty in V35.
    ' Captions use static text to prevent field-update freezes.

End Sub

Private Function CaptureCaptionMapV35( _
                    ByVal doc As Document, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef captionStarts() As Long, _
                    ByRef captionTypes() As Integer, _
                    ByRef headingStyleNames() As String, _
                    ByRef sectionNumbers() As String, _
                    ByRef sequenceIDs() As String, _
                    ByRef ordinalNumbers() As Long, _
                    ByVal stepName As String) As Long

    Const GROW_BY As Long = 128

    Dim mainRange As Range
    Dim para As Paragraph
    Dim count As Long
    Dim capacity As Long
    Dim headingLevel As Integer
    Dim captionType As Integer
    Dim currentH1 As String
    Dim currentH2 As String
    Dim sectionNumber As String
    Dim styleRefName As String
    Dim sequenceKey As String
    Dim sequenceCounts As Object
    Dim scannedParagraphs As Long

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long

    capacity = GROW_BY

    ReDim captionStarts(1 To capacity)
    ReDim captionTypes(1 To capacity)
    ReDim headingStyleNames(1 To capacity)
    ReDim sectionNumbers(1 To capacity)
    ReDim sequenceIDs(1 To capacity)
    ReDim ordinalNumbers(1 To capacity)

    Set sequenceCounts = CreateObject("Scripting.Dictionary")
    sequenceCounts.CompareMode = vbTextCompare

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedParagraphs = scannedParagraphs + 1

        If scannedParagraphs Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedParagraphs, "#,##0") & _
                " paragraphs; found " & _
                Format$(count, "#,##0") & " captions"
            DoEvents
        End If

        If Not IsPositionInsideTableOfContents( _
                para.Range.Start, tocStarts, tocEnds, tocCount) Then

            headingLevel = 0

            If ParagraphHasStyleV35(para, styH1) Then
                headingLevel = 1
            ElseIf ParagraphHasStyleV35(para, styH2) Then
                headingLevel = 2
            End If

            If headingLevel = 1 Then
                currentH1 = NormalizeHeadingNumberForCaptionV35( _
                    SafeListStringV35(para))
                currentH2 = ""
            ElseIf headingLevel = 2 Then
                currentH2 = NormalizeHeadingNumberForCaptionV35( _
                    SafeListStringV35(para))
            End If

            If Not para.Range.Information(wdWithInTable) Then
                captionType = GetCaptionTypeV35( _
                    doc, para, styCaption, _
                    styFigureCaption, styTableCaption)

                If captionType > 0 Then

                    count = count + 1

                    If count > capacity Then
                        capacity = capacity + GROW_BY
                        ReDim Preserve captionStarts(1 To capacity)
                        ReDim Preserve captionTypes(1 To capacity)
                        ReDim Preserve headingStyleNames(1 To capacity)
                        ReDim Preserve sectionNumbers(1 To capacity)
                        ReDim Preserve sequenceIDs(1 To capacity)
                        ReDim Preserve ordinalNumbers(1 To capacity)
                    End If

                    If Len(currentH2) > 0 Then
                        sectionNumber = currentH2
                        styleRefName = styH2.NameLocal
                    ElseIf Len(currentH1) > 0 Then
                        sectionNumber = currentH1
                        styleRefName = styH1.NameLocal
                    Else
                        sectionNumber = "0"
                        styleRefName = ""
                    End If

                    captionStarts(count) = para.Range.Start
                    captionTypes(count) = captionType
                    headingStyleNames(count) = styleRefName
                    sectionNumbers(count) = sectionNumber

                    If captionType = 1 Then
                        sequenceIDs(count) = _
                            MakeSequenceIdentifierV35( _
                                "Fig_", sectionNumber)
                    Else
                        sequenceIDs(count) = _
                            MakeSequenceIdentifierV35( _
                                "Tbl_", sectionNumber)
                    End If

                    sequenceKey = CStr(captionType) & "|" & _
                                  sectionNumber

                    If sequenceCounts.Exists(sequenceKey) Then
                        sequenceCounts(sequenceKey) = _
                            CLng(sequenceCounts(sequenceKey)) + 1
                    Else
                        sequenceCounts.Add sequenceKey, 1
                    End If

                    ordinalNumbers(count) = _
                        CLng(sequenceCounts(sequenceKey))

                    If count Mod 50 = 0 Then
                        Application.StatusBar = _
                            stepName & ": " & _
                            Format$(count, "#,##0") & _
                            " captions detected"
                        DoEvents
                    End If
                End If
            End If
        End If

    Next para

    If count > 0 Then
        ReDim Preserve captionStarts(1 To count)
        ReDim Preserve captionTypes(1 To count)
        ReDim Preserve headingStyleNames(1 To count)
        ReDim Preserve sectionNumbers(1 To count)
        ReDim Preserve sequenceIDs(1 To count)
        ReDim Preserve ordinalNumbers(1 To count)
    End If

    CaptureCaptionMapV35 = count

End Function

Private Function ParagraphHasStyleV35( _
                    ByVal para As Paragraph, _
                    ByVal sty As Style) As Boolean

    Dim paraStyle As Style

    If sty Is Nothing Then Exit Function

    On Error Resume Next
    Set paraStyle = para.Range.Style
    On Error GoTo 0

    If paraStyle Is Nothing Then Exit Function

    ParagraphHasStyleV35 = _
        (NormalizeStyleName(paraStyle.NameLocal) = _
         NormalizeStyleName(sty.NameLocal))

End Function

Private Function SafeListStringV35( _
                    ByVal para As Paragraph) As String

    On Error Resume Next
    SafeListStringV35 = para.Range.ListFormat.ListString
    On Error GoTo 0

End Function

Private Function NormalizeHeadingNumberForCaptionV35( _
                    ByVal numberText As String) As String

    Dim value As String
    Dim lastCharacter As String

    value = Trim$(numberText)

    Do While Len(value) > 0
        lastCharacter = Right$(value, 1)

        If lastCharacter = "." Or _
           lastCharacter = ChrW(&HFF0E) Or _
           lastCharacter = " " Or _
           lastCharacter = ChrW(160) Or _
           lastCharacter = ChrW(12288) Then

            value = Left$(value, Len(value) - 1)
        Else
            Exit Do
        End If
    Loop

    NormalizeHeadingNumberForCaptionV35 = value

End Function

Private Function GetCaptionTypeV35( _
                    ByVal doc As Document, _
                    ByVal para As Paragraph, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style) As Integer

    Dim paraStyle As Style
    Dim styleName As String
    Dim textValue As String
    Dim isGenericCaption As Boolean

    On Error Resume Next
    Set paraStyle = para.Range.Style
    On Error GoTo 0

    If Not paraStyle Is Nothing Then
        styleName = NormalizeStyleName(paraStyle.NameLocal)

        If styleName = _
           NormalizeStyleName(styFigureCaption.NameLocal) Then

            GetCaptionTypeV35 = 1
            Exit Function
        End If

        If styleName = _
           NormalizeStyleName(styTableCaption.NameLocal) Then

            GetCaptionTypeV35 = 2
            Exit Function
        End If

        isGenericCaption = _
            (styleName = NormalizeStyleName(styCaption.NameLocal)) Or _
            IsBuiltInStyle(doc, paraStyle, wdStyleCaption) Or _
            IsCommonCaptionName(styleName)
    End If

    textValue = CleanParagraphTextV35(para.Range.Text)

    If StartsWithCaptionLabelV35(textValue, 1) Then
        GetCaptionTypeV35 = 1
    ElseIf StartsWithCaptionLabelV35(textValue, 2) Then
        GetCaptionTypeV35 = 2
    ElseIf isGenericCaption Then
        ' A generic caption without a figure/table label is left unchanged.
        GetCaptionTypeV35 = 0
    End If

End Function

Private Function CleanParagraphTextV35( _
                    ByVal textValue As String) As String

    textValue = Replace(textValue, Chr$(13), "")
    textValue = Replace(textValue, Chr$(7), "")

    CleanParagraphTextV35 = textValue

End Function

Private Function StartsWithCaptionLabelV35( _
                    ByVal textValue As String, _
                    ByVal captionType As Integer) As Boolean

    Dim i As Long
    Dim labelText As String
    Dim englishLabel As String
    Dim afterPosition As Long
    Dim nextCharacter As String

    i = 1

    Do While i <= Len(textValue) And _
             IsCaptionSpaceCharacterV35(Mid$(textValue, i, 1))
        i = i + 1
    Loop

    If captionType = 1 Then
        labelText = FigureLabelTextV35()
        englishLabel = "figure"
    Else
        labelText = TableLabelTextV35()
        englishLabel = "table"
    End If

    If Mid$(textValue, i, Len(labelText)) = labelText Then
        afterPosition = i + Len(labelText)

        If afterPosition > Len(textValue) Then
            StartsWithCaptionLabelV35 = True
            Exit Function
        End If

        nextCharacter = Mid$(textValue, afterPosition, 1)

        StartsWithCaptionLabelV35 = _
            IsCaptionSpaceCharacterV35(nextCharacter) Or _
            IsCaptionDigitV35(nextCharacter) Or _
            IsCaptionPunctuationV35(nextCharacter)

        Exit Function
    End If

    If LCase$(Mid$(textValue, i, Len(englishLabel))) = _
       englishLabel Then

        afterPosition = i + Len(englishLabel)

        If afterPosition > Len(textValue) Then
            StartsWithCaptionLabelV35 = True
        Else
            nextCharacter = Mid$(textValue, afterPosition, 1)

            StartsWithCaptionLabelV35 = _
                IsCaptionSpaceCharacterV35(nextCharacter) Or _
                IsCaptionDigitV35(nextCharacter) Or _
                IsCaptionPunctuationV35(nextCharacter)
        End If
    End If

End Function

Private Sub StripExistingCaptionPrefixV35( _
                    ByVal para As Paragraph, _
                    ByVal captionType As Integer)

    Dim loopCount As Integer
    Dim textValue As String
    Dim prefixLength As Long
    Dim deleteRange As Range

    For loopCount = 1 To 3

        textValue = CleanParagraphTextV35(para.Range.Text)
        prefixLength = CaptionPrefixLengthV35( _
            textValue, captionType)

        If prefixLength <= 0 Then Exit For

        Set deleteRange = para.Range.Duplicate
        deleteRange.End = _
            deleteRange.Start + prefixLength
        deleteRange.Delete

    Next loopCount

    RemoveLeadingCaptionWhitespaceV35 para

End Sub

Private Function CaptionPrefixLengthV35( _
                    ByVal textValue As String, _
                    ByVal captionType As Integer) As Long

    Dim i As Long
    Dim labelText As String
    Dim englishLabel As String
    Dim afterLabel As Long
    Dim characterValue As String
    Dim hasDigit As Boolean

    i = 1

    Do While i <= Len(textValue) And _
             IsCaptionSpaceCharacterV35(Mid$(textValue, i, 1))
        i = i + 1
    Loop

    If captionType = 1 Then
        labelText = FigureLabelTextV35()
        englishLabel = "figure"
    Else
        labelText = TableLabelTextV35()
        englishLabel = "table"
    End If

    If Mid$(textValue, i, Len(labelText)) = labelText Then
        afterLabel = i + Len(labelText)

        If afterLabel <= Len(textValue) Then
            characterValue = Mid$(textValue, afterLabel, 1)

            If Not IsCaptionSpaceCharacterV35(characterValue) And _
               Not IsCaptionDigitV35(characterValue) And _
               Not IsCaptionPunctuationV35(characterValue) Then

                Exit Function
            End If
        End If

        i = afterLabel
    ElseIf LCase$(Mid$(textValue, i, Len(englishLabel))) = _
           englishLabel Then

        afterLabel = i + Len(englishLabel)

        If afterLabel <= Len(textValue) Then
            characterValue = Mid$(textValue, afterLabel, 1)

            If Not IsCaptionSpaceCharacterV35(characterValue) And _
               Not IsCaptionDigitV35(characterValue) And _
               Not IsCaptionPunctuationV35(characterValue) Then

                Exit Function
            End If
        End If

        i = afterLabel
    Else
        Exit Function
    End If

    Do While i <= Len(textValue) And _
             IsCaptionSpaceCharacterV35(Mid$(textValue, i, 1))
        i = i + 1
    Loop

    Do While i <= Len(textValue)
        characterValue = Mid$(textValue, i, 1)

        If IsCaptionDigitV35(characterValue) Then
            hasDigit = True
            i = i + 1
        ElseIf IsCaptionNumberSeparatorV35(characterValue) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    ' Remove punctuation and spacing after an existing number.
    Do While i <= Len(textValue)
        characterValue = Mid$(textValue, i, 1)

        If IsCaptionSpaceCharacterV35(characterValue) Or _
           IsCaptionPunctuationV35(characterValue) Then
            i = i + 1
        Else
            Exit Do
        End If
    Loop

    If hasDigit Then
        CaptionPrefixLengthV35 = i - 1
    Else
        CaptionPrefixLengthV35 = afterLabel - 1

        Do While CaptionPrefixLengthV35 < Len(textValue) And _
                 IsCaptionSpaceCharacterV35( _
                    Mid$(textValue, _
                         CaptionPrefixLengthV35 + 1, 1))

            CaptionPrefixLengthV35 = _
                CaptionPrefixLengthV35 + 1
        Loop
    End If

End Function

Private Sub RemoveLeadingCaptionWhitespaceV35( _
                    ByVal para As Paragraph)

    Dim textValue As String
    Dim removeCount As Long
    Dim deleteRange As Range

    textValue = CleanParagraphTextV35(para.Range.Text)

    Do While removeCount < Len(textValue) And _
             IsCaptionSpaceCharacterV35( _
                Mid$(textValue, removeCount + 1, 1))

        removeCount = removeCount + 1
    Loop

    If removeCount > 0 Then
        Set deleteRange = para.Range.Duplicate
        deleteRange.End = deleteRange.Start + removeCount
        deleteRange.Delete
    End If

End Sub

Private Sub InsertCaptionPrefixFieldsV35( _
                    ByVal doc As Document, _
                    ByVal para As Paragraph, _
                    ByVal labelText As String, _
                    ByVal headingStyleName As String, _
                    ByVal sectionNumber As String, _
                    ByVal sequenceID As String, _
                    ByVal ordinalNumber As Long)

    ' Intentionally empty. V35 never creates or recalculates captions.

End Sub

Private Sub ApplyCaptionDirectFormatV35( _
                    ByVal targetRange As Range, _
                    ByVal captionType As Integer)

    ' Figure and table captions use identical formatting.
    ' Only paragraph spacing differs.
    On Error Resume Next

    SetRangeFontV10 _
        targetRange, FontHeiTiName(), "SimHei", 12

    targetRange.Font.Bold = False

    With targetRange.ParagraphFormat
        .OutlineLevel = wdOutlineLevelBodyText
        .Alignment = wdAlignParagraphCenter
        .LineSpacingRule = wdLineSpaceExactly
        .LineSpacing = 20
        .LeftIndent = 0
        .RightIndent = 0
        .CharacterUnitLeftIndent = 0
        .CharacterUnitRightIndent = 0
        .CharacterUnitFirstLineIndent = 0
        .FirstLineIndent = 0
        .DisableLineHeightGrid = True
        .KeepTogether = True

        If captionType = 1 Then
            ' Figure caption: half-line spacing after.
            .SpaceBefore = 0
            .SpaceAfter = 10
            .KeepWithNext = False
        Else
            ' Table caption: half-line spacing before.
            .SpaceBefore = 10
            .SpaceAfter = 0
            .KeepWithNext = True
        End If
    End With

    On Error GoTo 0

End Sub

Private Function MakeSequenceIdentifierV35( _
                    ByVal prefixText As String, _
                    ByVal sectionNumber As String) As String

    Dim i As Long
    Dim characterValue As String
    Dim resultValue As String

    resultValue = prefixText

    For i = 1 To Len(sectionNumber)
        characterValue = Mid$(sectionNumber, i, 1)

        If characterValue >= "0" And _
           characterValue <= "9" Then

            resultValue = resultValue & characterValue
        Else
            If Right$(resultValue, 1) <> "_" Then
                resultValue = resultValue & "_"
            End If
        End If
    Next i

    If Right$(resultValue, 1) = "_" Then
        resultValue = Left$(resultValue, _
                           Len(resultValue) - 1)
    End If

    MakeSequenceIdentifierV35 = resultValue

End Function

Private Function IsCaptionSpaceCharacterV35( _
                    ByVal characterValue As String) As Boolean

    IsCaptionSpaceCharacterV35 = _
        (characterValue = " ") Or _
        (characterValue = vbTab) Or _
        (characterValue = ChrW(160)) Or _
        (characterValue = ChrW(12288))

End Function

Private Function IsCaptionDigitV35( _
                    ByVal characterValue As String) As Boolean

    IsCaptionDigitV35 = _
        (characterValue >= "0" And _
         characterValue <= "9")

End Function

Private Function IsCaptionNumberSeparatorV35( _
                    ByVal characterValue As String) As Boolean

    IsCaptionNumberSeparatorV35 = _
        (characterValue = ".") Or _
        (characterValue = ChrW(&HFF0E)) Or _
        (characterValue = "-") Or _
        (characterValue = ChrW(&HFF0D)) Or _
        (characterValue = ChrW(&H2013)) Or _
        (characterValue = ChrW(&H2014))

End Function

Private Function IsCaptionPunctuationV35( _
                    ByVal characterValue As String) As Boolean

    IsCaptionPunctuationV35 = _
        IsCaptionNumberSeparatorV35(characterValue) Or _
        (characterValue = ":") Or _
        (characterValue = ChrW(&HFF1A)) Or _
        (characterValue = ChrW(12289))

End Function

Private Function FigureLabelTextV35() As String
    FigureLabelTextV35 = U("56FE")
End Function

Private Function TableLabelTextV35() As String
    TableLabelTextV35 = U("8868")
End Function

Private Sub StripTypedHeadingPrefix(ByVal para As Paragraph, _
                                    ByVal headingLevel As Integer)

    Dim regexObject As Object
    Dim matches As Object
    Dim textRange As Range
    Dim deleteRange As Range
    Dim patternText As String
    Dim loopCount As Integer

    On Error GoTo SafeExit

    Set regexObject = CreateObject("VBScript.RegExp")
    regexObject.Global = False
    regexObject.IgnoreCase = True

    patternText = BuildHeadingPrefixPattern(headingLevel)
    regexObject.Pattern = patternText

    For loopCount = 1 To 3

        Set textRange = para.Range.Duplicate

        If textRange.End > textRange.Start Then
            textRange.End = textRange.End - 1
        End If

        Set matches = regexObject.Execute(textRange.Text)

        If matches.Count = 0 Then Exit For

        Set deleteRange = para.Range.Duplicate
        deleteRange.End = deleteRange.Start + matches(0).Length
        deleteRange.Delete

    Next loopCount

SafeExit:
End Sub

Private Function BuildHeadingPrefixPattern( _
                    ByVal headingLevel As Integer) As String

    Dim ws As String
    Dim separator As String
    Dim trailingPunctuation As String
    Dim numberPart As String
    Dim i As Integer

    ws = "[ " & vbTab & ChrW(160) & ChrW(12288) & "]"
    separator = "[\." & ChrW(&HFF0E) & "]"
    trailingPunctuation = "[\." & ChrW(&HFF0E) & ChrW(12289) & "]"

    numberPart = "[0-9]{1,3}"

    For i = 2 To headingLevel
        numberPart = numberPart & separator & "[0-9]{1,3}"
    Next i

    BuildHeadingPrefixPattern = _
        "^" & ws & "*" & numberPart & _
        "(" & trailingPunctuation & ws & "*|" & ws & "+)"

End Function

Private Function IsBuiltInStyle(ByVal doc As Document, _
                                ByVal currentStyle As Style, _
                                ByVal builtInStyleID As WdBuiltinStyle) As Boolean

    Dim builtInStyle As Style

    On Error Resume Next
    Set builtInStyle = doc.Styles(builtInStyleID)
    On Error GoTo 0

    If builtInStyle Is Nothing Then Exit Function

    IsBuiltInStyle = _
        (StrComp(currentStyle.NameLocal, _
                 builtInStyle.NameLocal, _
                 vbTextCompare) = 0)

End Function

Private Function IsCommonHeadingName(ByVal normalizedName As String, _
                                     ByVal headingLevel As Integer) As Boolean

    Dim levelText As String
    Dim chineseTitleName As String
    Dim chineseLevelTitleName As String
    Dim chineseDigitLevelTitleName As String

    levelText = CStr(headingLevel)
    chineseTitleName = U("6807 9898") & levelText
    chineseDigitLevelTitleName = levelText & U("7EA7 6807 9898")

    Select Case headingLevel
        Case 1
            chineseLevelTitleName = U("4E00 7EA7 6807 9898")
        Case 2
            chineseLevelTitleName = U("4E8C 7EA7 6807 9898")
        Case 3
            chineseLevelTitleName = U("4E09 7EA7 6807 9898")
        Case 4
            chineseLevelTitleName = U("56DB 7EA7 6807 9898")
    End Select

    IsCommonHeadingName = _
        (normalizedName = "heading" & levelText) Or _
        (normalizedName = NormalizeStyleName(chineseTitleName)) Or _
        (normalizedName = NormalizeStyleName(chineseLevelTitleName)) Or _
        (normalizedName = NormalizeStyleName(chineseDigitLevelTitleName))

End Function

Private Function IsCommonCaptionName( _
                    ByVal normalizedName As String) As Boolean

    IsCommonCaptionName = _
        (normalizedName = "caption") Or _
        (normalizedName = NormalizeStyleName(U("56FE 9898"))) Or _
        (normalizedName = NormalizeStyleName(U("8868 9898")))

End Function

Private Function NormalizeStyleName(ByVal styleName As String) As String

    Dim value As String

    value = LCase$(Trim$(styleName))
    value = Replace(value, " ", "")
    value = Replace(value, ChrW(160), "")
    value = Replace(value, ChrW(12288), "")
    value = Replace(value, vbTab, "")

    NormalizeStyleName = value

End Function

Private Function CreatePublishAndVerifyStylesV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styCaption As Style, _
                    ByRef stateReport As String) As Long

    Dim confirmedCount As Long
    Dim fallbackCount As Long

    ' Word desktop VBA uses the Visibility property backwards in the
    ' Manage Styles / Quick Styles interface on many builds:
    ' Visibility = False means "show this recommended style".
    '
    ' Also, user-defined style names must be enabled explicitly.
    On Error Resume Next
    doc.FormattingShowFilter = wdShowFilterStylesAll
    doc.StyleSortMethod = wdStyleSortRecommended
    doc.FormattingShowUserStyleName = True
    doc.FormattingShowClear = True
    On Error GoTo 0

    If PublishRequiredStyleV35(styH1, 1) Then _
        confirmedCount = confirmedCount + 1

    If PublishRequiredStyleV35(styH2, 2) Then _
        confirmedCount = confirmedCount + 1

    If PublishRequiredStyleV35(styH3, 3) Then _
        confirmedCount = confirmedCount + 1

    If PublishRequiredStyleV35(styH4, 4) Then _
        confirmedCount = confirmedCount + 1

    If PublishRequiredStyleV35(styCaption, 5) Then _
        confirmedCount = confirmedCount + 1

    If PublishRequiredStyleV35(styBody, 6) Then _
        confirmedCount = confirmedCount + 1

    ' Keep built-in fallbacks visible if a particular Word build refuses
    ' one or more custom Quick Style entries.
    If confirmedCount < 6 Then
        fallbackCount = PublishBuiltInFallbackStylesV35(doc)
    End If

    stateReport = _
        "Document styles: " & CStr(doc.Styles.Count) & _
        "; custom styles confirmed: " & CStr(confirmedCount) & _
        "; fallback Quick Styles: " & CStr(fallbackCount) & _
        "; compatibility mode: " & CStr(doc.CompatibilityMode) & _
        "; save format: " & CStr(doc.SaveFormat)

    CreatePublishAndVerifyStylesV35 = confirmedCount

End Function

Private Function PublishRequiredStyleV35( _
                    ByVal sty As Style, _
                    ByVal priority As Long) As Boolean

    If sty Is Nothing Then Exit Function

    On Error GoTo PublishFailed

    sty.Locked = False
    sty.QuickStyle = True

    ' Important: for Word desktop VBA, False is the practical value
    ' that displays a style in Manage Styles / recommended styles.
    sty.Visibility = False
    sty.UnhideWhenUsed = False

    On Error Resume Next
    sty.Priority = priority
    Err.Clear
    On Error GoTo PublishFailed

    ' Verify the two properties that determine the Quick Styles entry.
    PublishRequiredStyleV35 = _
        (CBool(sty.QuickStyle) And (CBool(sty.Visibility) = False))

    Exit Function

PublishFailed:
    PublishRequiredStyleV35 = False

End Function

Private Function PublishBuiltInFallbackStylesV35( _
                    ByVal doc As Document) As Long

    Dim styleIDs As Variant
    Dim item As Variant
    Dim sty As Style
    Dim count As Long

    styleIDs = Array( _
        wdStyleNormal, _
        wdStyleHeading1, _
        wdStyleHeading2, _
        wdStyleHeading3, _
        wdStyleHeading4, _
        wdStyleCaption)

    For Each item In styleIDs
        Set sty = Nothing

        On Error Resume Next
        Set sty = doc.Styles(CLng(item))
        On Error GoTo 0

        If Not sty Is Nothing Then
            If PublishRequiredStyleV35(sty, count + 20) Then
                count = count + 1
            End If
        End If
    Next item

    PublishBuiltInFallbackStylesV35 = count

End Function

Private Sub ApplyBodyStyleToFirstUsableParagraphV35( _
                    ByVal doc As Document, _
                    ByVal styBody As Style)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim textValue As String

    On Error GoTo SafeExit

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs
        textValue = para.Range.Text
        textValue = Replace(textValue, Chr$(13), "")
        textValue = Replace(textValue, Chr$(7), "")
        textValue = Trim$(textValue)

        If Len(textValue) > 0 Then
            If Not para.Range.Information(wdWithInTable) Then
                ' Do not overwrite a heading or caption style.
                If para.OutlineLevel = wdOutlineLevelBodyText Then
                    para.Range.Style = styBody.NameLocal
                End If
                Exit For
            End If
        End If
    Next para

SafeExit:
End Sub

Private Sub PlaceCursorInFirstTextParagraphV35(ByVal doc As Document)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim textValue As String
    Dim targetRange As Range

    On Error GoTo SafeExit

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs
        textValue = para.Range.Text
        textValue = Replace(textValue, Chr$(13), "")
        textValue = Replace(textValue, Chr$(7), "")
        textValue = Trim$(textValue)

        If Len(textValue) > 0 Then
            Set targetRange = para.Range.Duplicate
            targetRange.Collapse wdCollapseStart
            targetRange.Select
            Exit For
        End If
    Next para

SafeExit:
End Sub

' Create/recreate and publish the required styles only.
' This is the fastest repair for a document whose Ribbon shows No Style.
Private Sub CreateRequiredStylesOnly_V35()

    Dim doc As Document
    Dim styBody As Style
    Dim styH1 As Style
    Dim styH2 As Style
    Dim styH3 As Style
    Dim styH4 As Style
    Dim styCaption As Style
    Dim styFigureCaption As Style
    Dim styTableCaption As Style
    Dim confirmedCount As Long
    Dim captionConfirmedCount As Long
    Dim stateReport As String

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    If doc.ReadOnly Then
        MsgBox "The active document is read-only.", vbExclamation
        Exit Sub
    End If

    On Error GoTo CreateError

    Set styBody = EnsureParagraphStyle(doc, StyleBodyName())
    Set styH1 = EnsureParagraphStyle(doc, StyleH1Name())
    Set styH2 = EnsureParagraphStyle(doc, StyleH2Name())
    Set styH3 = EnsureParagraphStyle(doc, StyleH3Name())
    Set styH4 = EnsureParagraphStyle(doc, StyleH4Name())
    Set styCaption = EnsureParagraphStyle(doc, StyleCaptionName())
    Set styFigureCaption = EnsureParagraphStyle(doc, StyleFigureCaptionName())
    Set styTableCaption = EnsureParagraphStyle(doc, StyleTableCaptionName())

    ConfigureBodyStyle doc, styBody
    ConfigureHeadingStyle styH1, styBody, wdOutlineLevel1, 18, 28, 1
    ConfigureHeadingStyle styH2, styBody, wdOutlineLevel2, 16, 26, 2
    ConfigureHeadingStyle styH3, styBody, wdOutlineLevel3, 15, 24, 3
    ConfigureHeadingStyle styH4, styBody, wdOutlineLevel4, 15, 24, 4
    ConfigureCaptionStyle styCaption, styBody
    ConfigureFigureCaptionStyleV35 styFigureCaption, styCaption, styBody
    ConfigureTableCaptionStyleV35 styTableCaption, styCaption, styBody

    confirmedCount = CreatePublishAndVerifyStylesV35( _
        doc, styBody, styH1, styH2, styH3, styH4, styCaption, _
        stateReport)

    If PublishRequiredStyleV35(styFigureCaption, 7) Then _
        captionConfirmedCount = captionConfirmedCount + 1

    If PublishRequiredStyleV35(styTableCaption, 8) Then _
        captionConfirmedCount = captionConfirmedCount + 1

    On Error Resume Next
    doc.Save
    Application.ScreenRefresh
    On Error GoTo 0

    PlaceCursorInFirstTextParagraphV35 doc

    MsgBox _
        "Required styles created and published." & vbCrLf & _
        "Core styles confirmed: " & CStr(confirmedCount) & " / 6" & vbCrLf & _
        "Caption styles confirmed: " & CStr(captionConfirmedCount) & " / 2" & vbCrLf & _
        stateReport, _
        vbInformation, _
        "Create Required Styles V35"

    Exit Sub

CreateError:
    MsgBox _
        "The required-style creation stopped." & vbCrLf & _
        "Error number: " & Err.Number & vbCrLf & _
        "Description: " & Err.Description, _
        vbCritical, _
        "VBA Error"

End Sub

' Diagnostic macro. It does not change paragraph formatting or numbering.
Private Sub DiagnoseStyles_V35()

    Dim doc As Document
    Dim reportText As String

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument

    reportText = _
        "Styles.Count: " & CStr(doc.Styles.Count) & vbCrLf & _
        "CompatibilityMode: " & CStr(doc.CompatibilityMode) & vbCrLf & _
        "SaveFormat: " & CStr(doc.SaveFormat) & vbCrLf & _
        "FormattingShowFilter: " & CStr(doc.FormattingShowFilter) & vbCrLf & _
        "Show user style names: " & CStr(doc.FormattingShowUserStyleName) & vbCrLf & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleBodyName()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleH1Name()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleH2Name()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleH3Name()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleH4Name()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleCaptionName()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleFigureCaptionName()) & vbCrLf & _
        RequiredStyleDiagnosticLineV35(doc, StyleTableCaptionName())

    MsgBox reportText, vbInformation, "Style Diagnostic V35"

End Sub

Private Function RequiredStyleDiagnosticLineV35( _
                    ByVal doc As Document, _
                    ByVal styleName As String) As String

    Dim sty As Style

    On Error Resume Next
    Set sty = doc.Styles(styleName)
    On Error GoTo 0

    If sty Is Nothing Then
        RequiredStyleDiagnosticLineV35 = styleName & ": MISSING"
        Exit Function
    End If

    On Error Resume Next
    RequiredStyleDiagnosticLineV35 = _
        sty.NameLocal & _
        ": Type=" & CStr(sty.Type) & _
        ", QuickStyle=" & CStr(sty.QuickStyle) & _
        ", Visibility(raw)=" & CStr(sty.Visibility) & _
        ", InUse=" & CStr(sty.InUse)
    On Error GoTo 0

End Function

' Repair the current document without rebuilding all heading numbering.
' Use this after V8/V9 or after a completed V10 run when the Ribbon
' still displays "No Style".

Private Function IndexExistingHeadingsAndCaptionsV35( _
                    ByVal doc As Document, _
                    ByVal styH1 As Style, _
                    ByVal styH2 As Style, _
                    ByVal styH3 As Style, _
                    ByVal styH4 As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef captionStarts() As Long, _
                    ByRef captionTypes() As Integer, _
                    ByRef captionSections() As String, _
                    ByRef captionOrdinals() As Long, _
                    ByRef level4Count As Long, _
                    ByRef level4ErrorCount As Long, _
                    ByVal stepName As String) As Long

    Const CAPTION_GROW_BY As Long = 128

    Dim mainRange As Range
    Dim para As Paragraph
    Dim headingLevel As Integer
    Dim captionType As Integer
    Dim currentH1 As String
    Dim currentH2 As String
    Dim currentSection As String
    Dim figureOrdinal As Long
    Dim tableOrdinal As Long
    Dim captionCount As Long
    Dim capacity As Long
    Dim scannedCount As Long

    Dim tocStarts() As Long
    Dim tocEnds() As Long
    Dim tocCount As Long
    Dim tocIndex As Long

    Dim h1Name As String
    Dim h2Name As String
    Dim h3Name As String
    Dim h4Name As String
    Dim figureStyleName As String
    Dim tableStyleName As String

    capacity = CAPTION_GROW_BY

    ReDim captionStarts(1 To capacity)
    ReDim captionTypes(1 To capacity)
    ReDim captionSections(1 To capacity)
    ReDim captionOrdinals(1 To capacity)

    h1Name = styH1.NameLocal
    h2Name = styH2.NameLocal
    h3Name = styH3.NameLocal
    h4Name = styH4.NameLocal
    figureStyleName = styFigureCaption.NameLocal
    tableStyleName = styTableCaption.NameLocal

    BuildTableOfContentsBoundaries doc, tocStarts, tocEnds, tocCount
    tocIndex = 1

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not IsPositionInsideTocSequentialV35( _
                para.Range.Start, tocStarts, tocEnds, _
                tocCount, tocIndex) Then

            If Not para.Range.Information(wdWithInTable) Then

                headingLevel = GetTargetHeadingLevelFastV35( _
                    para, h1Name, h2Name, h3Name, h4Name)

                If headingLevel = 4 Or _
                   ExistingListLevelV35(para) = 4 Or _
                   LooksLikeLevel4HeadingV35(para.Range.Text) Then

                    On Error Resume Next
                    Err.Clear
                    para.Range.Style = styH4.NameLocal
                    ApplyLevel4DirectFormatV35 para.Range

                    If Err.Number = 0 Then
                        level4Count = level4Count + 1
                    Else
                        level4ErrorCount = level4ErrorCount + 1
                    End If

                    Err.Clear
                    On Error GoTo 0
                End If

                If headingLevel = 1 Then
                    currentH1 = NormalizeHeadingNumberForCaptionV35( _
                        SafeListStringV35(para))
                    currentH2 = ""
                    currentSection = currentH1
                    figureOrdinal = 0
                    tableOrdinal = 0
                ElseIf headingLevel = 2 Then
                    currentH2 = NormalizeHeadingNumberForCaptionV35( _
                        SafeListStringV35(para))
                    currentSection = currentH2
                    figureOrdinal = 0
                    tableOrdinal = 0
                Else
                    captionType = GetCaptionTypeFastV35( _
                        para, figureStyleName, tableStyleName)

                    If captionType > 0 Then

                        captionCount = captionCount + 1

                        If captionCount > capacity Then
                            capacity = capacity + CAPTION_GROW_BY
                            ReDim Preserve captionStarts(1 To capacity)
                            ReDim Preserve captionTypes(1 To capacity)
                            ReDim Preserve captionSections(1 To capacity)
                            ReDim Preserve captionOrdinals(1 To capacity)
                        End If

                        If Len(currentSection) = 0 Then
                            If Len(currentH2) > 0 Then
                                currentSection = currentH2
                            ElseIf Len(currentH1) > 0 Then
                                currentSection = currentH1
                            Else
                                currentSection = "0"
                            End If
                        End If

                        captionStarts(captionCount) = para.Range.Start
                        captionTypes(captionCount) = captionType
                        captionSections(captionCount) = currentSection

                        If captionType = 1 Then
                            figureOrdinal = figureOrdinal + 1
                            captionOrdinals(captionCount) = figureOrdinal
                        Else
                            tableOrdinal = tableOrdinal + 1
                            captionOrdinals(captionCount) = tableOrdinal
                        End If
                    End If
                End If
            End If
        End If

        If scannedCount Mod 200 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; captions " & Format$(captionCount, "#,##0")
            DoEvents
        End If
    Next para

    If captionCount > 0 Then
        ReDim Preserve captionStarts(1 To captionCount)
        ReDim Preserve captionTypes(1 To captionCount)
        ReDim Preserve captionSections(1 To captionCount)
        ReDim Preserve captionOrdinals(1 To captionCount)
    End If

    IndexExistingHeadingsAndCaptionsV35 = captionCount

End Function


Private Sub RepairCaptionsFastV35( _
                    ByVal doc As Document, _
                    ByVal styCaption As Style, _
                    ByVal styFigureCaption As Style, _
                    ByVal styTableCaption As Style, _
                    ByRef figureCount As Long, _
                    ByRef tableCount As Long, _
                    ByRef errorCount As Long, _
                    ByVal stepName As String)

    Dim mainRange As Range
    Dim para As Paragraph
    Dim captionType As Integer
    Dim scannedCount As Long

    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        scannedCount = scannedCount + 1

        If Not para.Range.Information(wdWithInTable) Then
            captionType = DetectCaptionTypeFastV35( _
                para, styCaption, styFigureCaption, styTableCaption)

            If captionType > 0 Then
                On Error GoTo CaptionError

                RemoveCaptionAutomaticNumberingV35 para

                If captionType = 1 Then
                    para.Range.Style = styFigureCaption.NameLocal
                    ApplyCaptionDirectFormatV35 para.Range, 1
                    RemoveCaptionAutomaticNumberingV35 para
                    ApplyCaptionDirectFormatV35 para.Range, 1
                    figureCount = figureCount + 1
                Else
                    para.Range.Style = styTableCaption.NameLocal
                    ApplyCaptionDirectFormatV35 para.Range, 2
                    RemoveCaptionAutomaticNumberingV35 para
                    ApplyCaptionDirectFormatV35 para.Range, 2
                    tableCount = tableCount + 1
                End If
            End If
        End If

ContinueCaption:
        On Error GoTo 0

        If scannedCount Mod 500 = 0 Then
            Application.StatusBar = _
                stepName & ": scanned " & _
                Format$(scannedCount, "#,##0") & _
                "; corrected " & _
                Format$(figureCount + tableCount, "#,##0")
            DoEvents
        End If
    Next para

    Exit Sub

CaptionError:
    errorCount = errorCount + 1
    Err.Clear
    Resume ContinueCaption

End Sub


Private Sub PreviewHeadingClassification_V35()

    Dim doc As Document
    Dim mainRange As Range
    Dim para As Paragraph
    Dim outlineLevel As WdOutlineLevel
    Dim totalParagraphs As Long
    Dim bodyCount As Long
    Dim h1Count As Long
    Dim h2Count As Long
    Dim h3Count As Long
    Dim h4Count As Long

    If Documents.Count = 0 Then
        MsgBox "No Word document is open.", vbExclamation
        Exit Sub
    End If

    Set doc = ActiveDocument
    Set mainRange = doc.StoryRanges(wdMainTextStory).Duplicate

    For Each para In mainRange.Paragraphs

        totalParagraphs = totalParagraphs + 1
        outlineLevel = wdOutlineLevelBodyText

        On Error Resume Next
        outlineLevel = para.OutlineLevel
        On Error GoTo 0

        Select Case outlineLevel
            Case wdOutlineLevel1
                h1Count = h1Count + 1
            Case wdOutlineLevel2
                h2Count = h2Count + 1
            Case wdOutlineLevel3
                h3Count = h3Count + 1
            Case wdOutlineLevel4
                h4Count = h4Count + 1
            Case Else
                bodyCount = bodyCount + 1
        End Select

        If totalParagraphs Mod 2000 = 0 Then DoEvents
    Next para

    MsgBox _
        "V35 outline-level preview - NO formatting performed." & vbCrLf & _
        "Total paragraphs: " & CStr(totalParagraphs) & vbCrLf & _
        "Outline level 1: " & CStr(h1Count) & vbCrLf & _
        "Outline level 2: " & CStr(h2Count) & vbCrLf & _
        "Outline level 3: " & CStr(h3Count) & vbCrLf & _
        "Outline level 4: " & CStr(h4Count) & vbCrLf & _
        "Body/other outline levels: " & CStr(bodyCount) & vbCrLf & vbCrLf & _
        "Numeric body paragraphs are NOT promoted to headings.", _
        vbInformation, _
        "Outline Preview V35"

End Sub

Private Sub RepairCurrentDocument_V35()

    OneClick_FormatDocument_V35

End Sub

' Compatibility alias. The optimized repair also updates tables, pictures and captions.
Private Sub RepairStyleGallery_V35()

    RepairCurrentDocument_V35

End Sub

Private Sub ShowKeptStyle(ByVal sty As Style, ByVal priority As Long)

    ' Gallery publication is postponed until the end. V12 then creates,
    ' publishes and verifies all six required styles explicitly.
    If sty Is Nothing Then Exit Sub

    On Error Resume Next
    sty.Priority = priority
    On Error GoTo 0

End Sub

Private Function StyleBodyName() As String
    StyleBodyName = U("6B63 6587")
End Function

Private Function StyleH1Name() As String
    StyleH1Name = U("6837 5F0F") & "1"
End Function

Private Function StyleH2Name() As String
    StyleH2Name = U("6837 5F0F") & "2"
End Function

Private Function StyleH3Name() As String
    StyleH3Name = U("6837 5F0F") & "3"
End Function

Private Function StyleH4Name() As String
    StyleH4Name = U("6837 5F0F") & "4"
End Function

Private Function StyleCaptionName() As String
    StyleCaptionName = U("9898 6CE8")
End Function

Private Function StyleFigureCaptionName() As String
    StyleFigureCaptionName = U("56FE 9898")
End Function

Private Function StyleTableCaptionName() As String
    StyleTableCaptionName = U("8868 9898")
End Function

Private Function FontFangSongGB2312Name() As String
    FontFangSongGB2312Name = U("4EFF 5B8B") & "_GB2312"
End Function

Private Function FontHeiTiName() As String
    FontHeiTiName = U("9ED1 4F53")
End Function

Private Function U(ByVal hexCodes As String) As String

    Dim parts() As String
    Dim i As Long
    Dim result As String

    parts = Split(hexCodes, " ")

    For i = LBound(parts) To UBound(parts)
        If Len(parts(i)) > 0 Then
            result = result & ChrW(CLng("&H" & parts(i)))
        End If
    Next i

    U = result

End Function

'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const SOURCE_SHA256 = '321C89B23C56775F5124CAAF39E8E25C76AD9F985958D73769FE5FAF6ECB011B';

// The user's source is retained unchanged. Only the in-memory runner copy is adapted.
function buildFormatter(file) {
  const bytes = fs.readFileSync(file);
  if (crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase() !== SOURCE_SHA256) throw new Error('随附 VBA 文件的校验值不匹配，请重新安装 SpecFlow。');
  let code = bytes.toString('ascii').replace(/^Attribute .*\r?\n/gm, '');
  code = code.replace(/\bMsgBox\b/g, 'SfMessage');
  code = code.replace(/(Option Explicit\s*\r?\n)/i, '$1\nPrivate SfReport As String\nPrivate SfSuccess As Boolean\nPrivate SfProgressPath As String\n');
  const start = code.indexOf('Public Sub OneClick_FormatDocument_V35()');
  const end = code.indexOf('End Sub', start) + 'End Sub'.length;
  if (start < 0 || end < start) throw new Error('VBA 主入口不存在');
  const main = code.slice(start, end).replace(/^(\s*)currentStep = ("[^"\r\n]*")\s*$/gm, '$1currentStep = $2\n$1SfProgress currentStep');
  code = code.slice(0, start) + main + code.slice(end);
  return code + `
Public Function SpecFlow_Run(ByVal progressPath As String) As String
    SfReport = ""
    SfSuccess = False
    SfProgressPath = progressPath
    OneClick_FormatDocument_V35
    If Not SfSuccess Then Err.Raise vbObjectError + 2711, "SpecFlow", Left$(SfReport, 1800)
    SpecFlow_Run = SfReport
End Function

Private Function SfMessage(ByVal Prompt As Variant, Optional ByVal Buttons As VbMsgBoxStyle = vbOKOnly, Optional ByVal Title As Variant, Optional ByVal HelpFile As Variant, Optional ByVal Context As Variant) As VbMsgBoxResult
    SfReport = CStr(Prompt)
    If Left$(SfReport, 9) = "Finished." Then SfSuccess = True
    SfMessage = vbOK
End Function

Private Sub SfProgress(ByVal stage As String)
    Dim fileNumber As Integer
    If Len(SfProgressPath) = 0 Then Exit Sub
    If Len(Dir$(SfProgressPath & ".cancel")) > 0 Then Err.Raise vbObjectError + 2712, "SpecFlow", "Formatting cancelled."
    fileNumber = FreeFile
    Open SfProgressPath For Append As #fileNumber
    Print #fileNumber, stage
    Close #fileNumber
End Sub
`;
}
module.exports = { buildFormatter, SOURCE_SHA256 };

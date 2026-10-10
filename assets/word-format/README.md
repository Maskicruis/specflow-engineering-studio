# 用户提供的 Word 格式规则

`ChineseDocumentFormatter_V35_1.bas` 是用户提供的 `ChineseDocumentFormatter_OneClick_V35_1_CAPTION_STYLEREF_FIX_ASCII.bas` 的逐字节副本，未修改规则或改写源文件。

SHA-256：`321C89B23C56775F5124CAAF39E8E25C76AD9F985958D73769FE5FAF6ECB011B`。

执行前校验原文件。`src/word-vba-adapter.js` 仅在任务目录生成运行副本：移除导入属性、将弹窗变为处理报告、增加进度和取消检查、包装固定入口 `OneClick_FormatDocument_V35`。不运行模型生成的 VBA 或脚本。

规则会标准化正文、既有标题层级、图表题注 / STYLEREF 域、表格、图片和页面格式。VBA 不是单纯视觉改动：可重建编号、题注域和样式，输出需核查。原上传文件始终保留；运行副本和规则的验证备份仅位于任务目录。

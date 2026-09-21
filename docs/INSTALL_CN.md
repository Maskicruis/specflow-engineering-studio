# SpecFlow Engineering Studio 安装说明

## 推荐安装方式

从 [GitHub Releases](https://github.com/Maskicruis/specflow-engineering-studio/releases/latest) 下载名称包含 `Setup` 的 Windows x64 安装包。安装向导允许选择目录，并可创建桌面和开始菜单快捷方式。若不希望安装，可下载 `Portable` 便携版直接运行。

## 首次启动必须完成的配置

SpecFlow v0.8.0 包含独立 Node.js 运行时，不要求系统预装 Node.js。它不再内置或启动 DeepSeek Harness，因而可以与 DeepSeek Harness Studio 同时运行。MinerU 仍是独立的 PDF 解析引擎；安装 SpecFlow 并不等于安装 MinerU。

1. 安装并确认 MinerU 可在本机运行；
2. 打开 SpecFlow 右上角“设置”；
3. 在“MinerU 解析引擎”中点击“浏览”，选择 `mineru.exe`（也可填写完整路径）；
4. 点击“检测”，看到“可用”后再导入 PDF；
5. 选择文档数据库目录并保存设置。

如果检测仍失败，请确认选择的是实际可执行文件，而不是安装目录、压缩包或快捷方式。便携版和安装版使用相同的 MinerU 配置方式。

## LLM（可选）

不配置 LLM 时，本地 BM25 检索、文档阅读和引用定位仍可使用。需要生成式回答时，在设置中填写 OpenAI 兼容的 Base URL、模型名和 API Key；也可以连接本地 Ollama/vLLM 兼容端点。

## 工程目录与设计工具

1. 打开左侧“设计助手”，选择项目根目录并填写项目名称；程序会在 `<根目录>\<项目名称>` 下创建阶段目录；
2. 默认目录可在“设置 → 项目与工具”逐行修改，之后新建项目自动使用新模板；已有项目可点击“同步目录模板”；
3. 全过程检查清单按“待收集 / 已具备 / 不适用”维护，备注可填写资料位置、责任人或处理意见；
4. 多功能计算器是外部程序。默认尝试使用 `C:\Users\Administrator\Desktop\工作任务\个人工具箱\设计工具\多功能计算器.exe`，路径不同请在设置中重新选择；
5. `Ctrl+Alt+C` 启动计算器，`Ctrl+Alt+R` 打开道路排水坡度设计器。坡度设计器的数据保存在本机应用浏览器存储中，也可导出 JSON。

安装包不会复制或分发外部计算器；若源程序被移动，需要重新选择路径。

## 连接 DeepSeek Harness Studio（可选）

1. 先安装并启动一次 DeepSeek Harness Studio，使它创建当前用户的 `%USERPROFILE%\.dsh\profiles\web`；
2. 打开 SpecFlow“设置 → Harness 连接”；
3. 点击“安装 / 更新集成组件”；
4. 完全退出并重新启动 DeepSeek Harness Studio。

Harness 中会新增 `specflow_status`、`specflow_list_groups`、`specflow_search` 和 `specflow_ask`，并安装 `/specflow-design-review` 本地 Skill。日常使用可直接输入：

```text
/specflow-design-review C:\项目\初步设计.docx
```

Skill 会自动检测 SpecFlow、选择相关规范分组、分主题检索、生成合规性对照表与修订建议，并始终保留原文件。也可以在命令后追加“仅审查消防章节”“使用变电站规范分组”或“仅生成审查报告”。只有明确需要 SpecFlow 内部模型生成回答时才使用 `specflow_ask`。

连接工具只访问 `127.0.0.1` / `localhost`。SpecFlow 会自动发布当前本机服务地址，因此自定义服务端口或默认端口被占用时不需要在 Harness 中重复配置。集成安装只增加一个工具插件和 `%USERPROFILE%\.dsh\skills\specflow-design-review`，不会修改 Harness Studio 源码，也不会覆盖模型、会话或其他社区插件。

## 完整性校验

Release 附带 `SHA256SUMS.txt`。PowerShell 可用以下命令核对：

```powershell
Get-FileHash .\SpecFlow-Engineering-Studio-Setup-0.8.0-x64.exe -Algorithm SHA256
```

输出应与 `SHA256SUMS.txt` 对应行一致。

当前公开安装包未使用商业代码签名证书；Windows SmartScreen 可能显示未知发布者。请只从本仓库 Release 下载，并先核对 SHA-256。

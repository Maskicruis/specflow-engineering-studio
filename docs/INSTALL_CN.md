# SpecFlow Engineering Studio 安装说明

## 推荐安装方式

从 [GitHub Releases](https://github.com/Maskicruis/specflow-engineering-studio/releases/latest) 下载名称包含 `Setup` 的 Windows x64 安装包。安装向导允许选择目录，并可创建桌面和开始菜单快捷方式。若不希望安装，可下载 `Portable` 便携版直接运行。

## 首次启动必须完成的配置

SpecFlow v0.5.0 已内置 DeepSeek Harness 和独立 Node.js 运行时，不要求系统预装 Node.js 或 DSH。MinerU 仍是独立的 PDF 解析引擎；安装 SpecFlow 并不等于安装 MinerU。

1. 安装并确认 MinerU 可在本机运行；
2. 打开 SpecFlow 右上角“设置”；
3. 在“MinerU 解析引擎”中点击“浏览”，选择 `mineru.exe`（也可填写完整路径）；
4. 点击“检测”，看到“可用”后再导入 PDF；
5. 选择文档数据库目录并保存设置。

如果检测仍失败，请确认选择的是实际可执行文件，而不是安装目录、压缩包或快捷方式。便携版和安装版使用相同的 MinerU 配置方式。

## LLM（可选）

不配置 LLM 时，本地 BM25 检索、文档阅读和引用定位仍可使用。需要生成式回答时，在设置中填写 OpenAI 兼容的 Base URL、模型名和 API Key；也可以连接本地 Ollama/vLLM 兼容端点。

## DeepSeek Harness Agent

首次打开“DeepSeek 智能体”时，程序会启动内置 DSH 服务。可在 SpecFlow 设置中修改 Harness 端口、默认项目目录和“随程序启动”。

DeepSeek API Key 由官方 DSH 管理并保存在 `%USERPROFILE%\.dsh\.credentials.yaml`。配置完成后，SpecFlow 标题栏会显示 API 余额；点击余额可手动刷新。密钥不会传入网页渲染层。

“打开项目”会把本地目录登记到 Harness 的项目记录中。SpecFlow 还会在 DSH Skills 目录安装受管理的 `specflow-knowledge-base` Skill，使 Agent 能访问本机 `/api/v1` 知识库接口。若同名 Skill 是用户自行创建的，程序会保留原文件而不覆盖。

## 完整性校验

Release 附带 `SHA256SUMS.txt`。PowerShell 可用以下命令核对：

```powershell
Get-FileHash .\SpecFlow-Engineering-Studio-Setup-0.5.0-x64.exe -Algorithm SHA256
```

输出应与 `SHA256SUMS.txt` 对应行一致。

当前公开安装包未使用商业代码签名证书；Windows SmartScreen 可能显示未知发布者。请只从本仓库 Release 下载，并先核对 SHA-256。

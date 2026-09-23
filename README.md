# SpecFlow Engineering Studio

面向工程规范与技术资料的本地桌面工作台。它把 **独立 LLM 问答、MinerU 文档解析、工程资料数据库、原文定位与高亮核查** 放在一个 Windows 客户端中，同时通过专用工具插件连接外部 DeepSeek Harness Studio。

[![Latest Release](https://img.shields.io/github/v/release/Maskicruis/specflow-engineering-studio?label=Release)](https://github.com/Maskicruis/specflow-engineering-studio/releases/latest)
[![Windows](https://img.shields.io/badge/Windows-10%20%2F%2011-3276d2)](https://github.com/Maskicruis/specflow-engineering-studio/releases/latest)
[![Tests](https://img.shields.io/badge/tests-78%20passed-38b27a)](#开发与验证)

> 独立工程版使用单独的产品名、应用标识、数据目录和 Release，不会覆盖早期知识库项目。

![工程助手](docs/assets/engineering-assistant-v0.4.png)

## 主要能力

- **工程助手 / 设计助手**：设置项目名称和保存位置后，自动建立 `00工作区间`、`01初步设计`、`02施工图设计`、`03提资资料`、`04收资资料`、`05规程规范`；目录模板可在设置中增删并同步到现有项目。
- **全过程资料完整性清单**：按项目依据、基础资料、收资与接口、初步设计、施工图准备分阶段跟踪；每项支持“待收集 / 已具备 / 不适用”、备注和完成率，内置洪水位、技术经济指标等关键提醒，也可追加自定义项目。
- **规范网站动态监测**：在文档数据库中登记规范发布页，按 6 小时、12 小时、每天或每周自动检查；保存页面基线、规范链接与变化记录，显示新增/移除项，并拒绝本机或局域网地址。
- **道路排水坡度网络设计**：画布只表达拓扑，不把网格当作实际距离；每条坡段只连接两个相邻节点并显示一个方向箭头，动画不会跨越中间节点。支持连续插点、双击延伸、框选移动、逐段反向，以及一键把节点设为分水高点或汇水低点。计算完全使用用户填写的实际距离、方向、设计坡度、已知标高与规范上下限。
- **可扩展工具库**：主工作台只负责按专业检索、分类和启动工具；内置工具在独立桌面窗口运行，重复打开会聚焦现有窗口，外部程序仍由安全工具注册表启动。`Ctrl+Alt+C` 调用多功能计算器，`Ctrl+Alt+R` 打开独立的坡度设计窗口。
- **DeepSeek 余额**：桌面标题栏读取当前用户 DeepSeek Harness 的凭据并查询官方余额接口；密钥不会返回界面、日志或写入仓库。
- **Harness 一键审查 Skill**：安装连接组件后，直接输入 `/specflow-design-review <设计文件路径>`，自动完成规范分组选择、分主题检索、合规矩阵、引用和非破坏式修订建议，无需重复编写长提示词。
- **外部 Harness 连接**：不再启动第二套 DSH 服务，也不再占用 Harness 端口；一键安装四个知识工具。Harness 回答中的“打开 SpecFlow 原文”链接会唤醒已经运行的 SpecFlow，并直接定位、高亮对应页。
- **语义查询规划与追问**：在检索前把工程口语扩展为规范术语，例如把“综合楼”关联到“民用建筑群、民用建筑、公共建筑”等表达；当用途、高度、生产储存内容或相邻建筑信息不足时，先要求补充条件，再给出防火间距或危险性分类结论。
- **自动服务发现**：SpecFlow 启动时向当前用户的 DSH 目录写入本机回环地址，Harness 工具可自动适配自定义端口或端口回退。
- **独立模型运行**：无需打开 Harness。直接配置任意 OpenAI 兼容的 DeepSeek、Ollama、vLLM 或其他模型，即可使用智能问答、仅资料库和通用对话。
- **完整工程助手**：像通用大模型客户端一样连续对话；可选“智能问答”“仅资料库”“通用对话”，资料不足时不再让整套系统失去通用问答能力。
- **Codex 式对话工作区**：左侧顶部可直接新建独立对话，最近记录使用单行、全高列表；点击即可恢复完整多轮内容、引用和检索范围，也可继续追问。
- **文档数据库**：集中管理 PDF、解析队列、状态、页数、图片和内容规模；通过明确的应用内对话框新建、重命名和删除文件分组，并支持逐文档归组。
- **分组问答**：问答范围可选择全部文档、指定分组、未分组或单个文档；空分组不会意外回退到全库检索。
- **MinerU 精准解析**：按真实阅读顺序输出 Markdown/结构化内容，保留表格、图片、页码和页内坐标。
- **引用与原文核查**：引用编号在相关句子后直接显示为超链接，回答末尾另列“文档名 + 页码 + 条文号 + 打开原文”链接；SpecFlow 与 Harness 中的链接都可回到桌面阅读器并高亮。
- **完整 PDF 阅读器**：自动适合页面，禁用陈旧 PDF 缓存；连续点击引用时隔离加载任务，显示明确加载状态，并可在失败后原位重试。
- **混合检索**：默认本地 BM25；配置向量模型后自动使用 BM25 + 向量 RRF 融合。
- **标准接口**：提供版本化 API、能力发现、Schema、SSE 流式问答和结构化条目导出。
- **客户端更新**：在“设置 → 软件更新”检查、下载并安装 GitHub Release；安装包必须通过 SHA-256 校验。
- **分类设置中心**：解析、独立模型、Harness 连接和软件更新分为四个独立页面。

![文档数据库](docs/assets/document-database-v0.3.png)

![软件更新设置](docs/assets/software-update-v0.3.png)

![PDF 原文定位与高亮](docs/assets/source-review-v0.4.png)

## 下载与安装

进入 [最新 Release](https://github.com/Maskicruis/specflow-engineering-studio/releases/latest)：

- 推荐：`SpecFlow-Engineering-Studio-Setup-<版本>-x64.exe`，可选择安装位置，会创建桌面和开始菜单快捷方式；
- 免安装：`SpecFlow-Engineering-Studio-Portable-<版本>-x64.exe`，直接运行；
- 完整性校验：`SHA256SUMS.txt`。

安装包包含独立运行所需的 Node.js 运行时，但**不再内置或启动 DeepSeek Harness，也不内置 MinerU 模型和运行环境**。首次使用请在右上角“设置”中配置模型，并选择已经安装的 `mineru.exe`。详见 [安装说明](docs/INSTALL_CN.md)。

## 使用流程

1. 打开“设置 → 模型接口”，填写 OpenAI 兼容 Base URL、模型名和 API Key；如只使用本地检索，可以跳过。
2. 在“设计助手”中选择项目根目录并填写项目名，创建标准目录；随后用全过程清单持续记录已收资料、缺项和责任备注。
3. 在“资料与解析”中选择文档数据库目录和 `mineru.exe`，保存后点击“检测”。
4. 如需从 DeepSeek Harness Studio 调用，在“设置 → Harness 连接”确认组件版本与当前 SpecFlow 一致；如显示旧版本，点击“更新至当前版本”，然后完全退出并重启 DeepSeek Harness Studio。
5. 在“文档数据库”页创建项目或专业分组，把已有文件归组；导入新 PDF 时也可以直接指定目标分组。
6. 在“知识库问答”中选择智能问答、仅资料库或通用对话，并在范围菜单中选择全部文档、指定分组或单个文档。点击正文引用或文后“打开原文”链接即可核查 PDF 并高亮。
7. 在“文档数据库 → 规范动态监测”登记规范发布网站并选择检查周期。后台计划任务仅在 SpecFlow 服务运行期间执行，也可随时点击“全部立即检查”。
8. 在“工具工作台”中按专业筛选或搜索工具；每个工具会在独立窗口中打开。道路坡度设计先插入控制节点，再双击节点按指定方向扩展。选中坡段填写真实距离与设计坡度，至少设置一个已知控制标高后计算网络。
9. 在 DeepSeek Harness 对话中输入 `/specflow-design-review C:\项目\初步设计.docx` 启动完整审查；普通问题由 Agent 调用 `specflow_search`。若返回 `clarify_user`，Harness 会先追问必要工程条件，再重新检索。回答后的原文链接会打开已运行的 SpecFlow。
10. 后续版本可在“设置 → 软件更新”中直接检查、下载和覆盖安装，工程项目、对话、分组和资料库不会被删除。

## 独立运行与 Agent 接入

桌面应用自行启动本地服务，无需浏览器。作为可调度工具时可只启动标准服务：

```powershell
node .\cli.js serve --host 127.0.0.1 --port 8890 --no-open
```

常用接口：

```text
GET   /api/v1/health
GET   /api/v1/capabilities
GET   /api/v1/groups
GET   /api/v1/search?q=消防车道&topK=8&group=<分组ID>
POST  /api/v1/ask
POST  /api/v1/ask/stream
GET   /api/v1/conversations?summary=1
GET   /api/v1/workspace
PATCH /api/v1/workspace
POST  /api/v1/projects
PATCH /api/v1/projects/:id/checklist/:itemId
GET   /api/v1/spec-monitors
POST  /api/v1/spec-monitors
POST  /api/v1/spec-monitors/check-all
GET   /api/v1/documents/:id/content
GET   /api/v1/documents/:id/source
POST  /api/v1/export/items
PATCH /api/v1/settings
```

响应采用统一成功/错误封装；请求支持 `retrievalMode: auto|knowledge|general`、`conversationId`、多轮 `history`、`groupId` 和 `docIds`。检索与问答响应同时返回 `queryPlan`；信息不足时 `mode=clarification`。引用包含桌面唤醒链接、原始 PDF 链接、页码、条文号和高亮坐标。

## 数据与隐私

- PDF、解析结果、索引、会话与设置默认保存在当前 Windows 用户的应用数据目录或用户指定的数据库目录；
- Harness 的项目、会话与模型凭据仍完全由 DeepSeek Harness Studio 管理；SpecFlow 仅写入本机服务发现记录，并在用户点击安装时增加一个工具插件和一个本地审查 Skill；
- 标题栏余额仅在本机桌面进程中读取 Harness 凭据并访问 DeepSeek 官方余额接口，API Key 不会通过页面桥接返回；
- 多功能计算器保持在用户指定位置运行，安装包和仓库均不复制该可执行文件；
- 更新和覆盖安装不会主动删除资料库；
- 智能/资料库模式会把检索命中的片段发给已配置的 LLM；通用对话只发送对话内容。若使用本地兼容模型，可保持资料不外发；
- API Key 不写入仓库，也不会进入 Release 产物。

## 开发与验证

```powershell
npm install
npm test
npm run desktop
npm run build:desktop
```

`npm run build:desktop` 会先准备独立 Node.js 运行时，再生成 Windows x64 安装版和便携版。自动化验证覆盖 Harness 工具与审查 Skill 安装、无内置 Harness 运行时、独立 LLM、分组检索、Codex 式最近对话、文件分组、规范网站监测安全边界与变化检测、道路网络标高传播与冲突校验、更新校验、解析顺序、连续文本块合并、表格、坐标、三种问答模式、引用定位和标准接口。

道路流向动画采用独立实现，并参考了 MIT 许可项目 [tt-a1i/archify](https://github.com/tt-a1i/archify) 的方向感知 trace-motion 设计思路；启用系统“减少动态效果”后会自动停用动画。

更多文档：[安装说明](docs/INSTALL_CN.md) · [API 契约](docs/API.md) · [更新机制](docs/UPDATES_CN.md) · [v0.9.3 发布说明](docs/RELEASE_NOTES_0.9.3_CN.md)

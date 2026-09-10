# SpecFlow Engineering Studio v0.2

独立的工程文档智能工作台，面向机械、电力及其他工程设计中的规范参数查证、设计依据核对和技术资料管理：
**导入 PDF → MinerU 精准解析为 Markdown/结构化内容 → 本地检索 → LLM 基于库内内容回答 → 引用可一键跳回原文并高亮核查**。

本工程版与原知识库版本使用不同的产品名、应用标识、默认数据目录和发行文件，不会覆盖原安装或原 GitHub Release。

## 组成

| 层 | 模块 | 说明 |
| --- | --- | --- |
| 解析层 | `src/mineru-adapter.js` + `pipeline.js` + `transform.js` | 调 MinerU 解析 PDF，产出 `document.json`（schema v1.0，含页码与**页内坐标**）、`view.json`、Markdown、图片 |
| 文档服务 | `src/service.js` + `http-server.js` | 导入/排队/进度/阅读/原 PDF/图片/修正 等 API（v1 与兼容接口） |
| 检索层 | `src/rag.js` | 对全库 `document.json` 建 **BM25** 索引（中文按字/二元词切分），命中天然携带 文档-页-块-坐标 |
| 问答层 | `src/qa.js` + `src/scenarios.js` | 检索 → 组装带编号上下文 → LLM 生成；未配置 LLM 时降级为检索结果 + 引用 |
| LLM 层 | `src/llm.js` | OpenAI 兼容 `/chat/completions`：DeepSeek、vLLM、Ollama（`http://127.0.0.1:11434/v1`）等 |
| 桌面外壳 | `desktop/main.cjs` + `desktop/preload.cjs` | Electron 原生窗口、窗口控制、目录选择和本地服务生命周期管理 |
| 界面 | `ui.html`（内嵌 PDF.js） | 独立“工程助手”页 + 新增“文档数据库”页 + 阅读视图；点引用 → 跳原 PDF 该页并**高亮该内容** |

## 界面设计

- 采用工程软件式固定标题栏、工作区侧栏和右侧设置抽屉；
- 工程助手与文档数据库是两个独立页面，不使用宣传型首页；
- 问答输入框固定在任务区底部，支持 `Enter` 发送、`Shift + Enter` 换行；
- 支持拖放导入、明暗主题和窄屏响应式布局；
- 解析状态、文档进度、回答与引用采用一致的状态层级，保留原有 PDF 定位、高亮和表格修正能力。

## 安装与使用（Windows）

构建产物位于 `release/`：

- `SpecFlow-Engineering-Studio-v0.2.0-Setup.exe`：安装版，可选择安装目录，并创建桌面与开始菜单快捷方式；
- `SpecFlow-Engineering-Studio-v0.2.0-Portable.exe`：免安装版，双击即可运行。

这是独立桌面软件，不需要手动打开浏览器。首次启动后：

1. 点击右上角「设置」，选择资料库目录并检测 MinerU；
2. 在「导入文档」中选择或拖入 PDF；
3. 解析完成后，在「知识问答」中查证内容，点击引用可回到 PDF 原文并高亮；
4. 如需生成式回答，在设置中填写 OpenAI 兼容的模型接口；不填写时仍可使用本地检索。

配置和索引默认保存在当前 Windows 用户的应用数据目录，升级软件不会覆盖资料库。

## 从源码运行

```bash
npm install
npm run desktop
```

仅在作为可调度服务或接入 Agent 时，才需要启动无界面的标准接口：

```powershell
node .\cli.js serve --host 127.0.0.1 --port 8890 --no-open
```

- 首次使用：在界面的「连接与解析设置」中配置 **资料库路径**、**MinerU 路径**、**解析参数**、**服务端口**与 **LLM 接口**；端口修改在重启程序后生效；
- 导入 PDF → 等待解析（有进度与实时日志）→ 在「💬 知识库问答」里提问；
- 回答中的引用卡片点击 → 打开该文档对应页并高亮命中块（表格/图同样可高亮）。

## 配置 LLM（二选一）

1. **云端（示例 DeepSeek）**：baseUrl 填 `https://api.deepseek.com/v1`，model 填 `deepseek-chat`，填入 API Key；
2. **本地（Ollama）**：baseUrl 填 `http://127.0.0.1:11434/v1`，model 填 `qwen2.5:14b`（示例），Key 留空。

桌面版配置写入 Windows 用户应用数据目录下的 `data/settings.json`；源码服务模式写入项目的 `data/settings.json`。未配置模型时平台仍可用（检索模式：给出原文片段与引用）。

## API（节选）

```text
GET  /api/v1/health                 # 服务/索引/LLM 状态
GET  /api/v1/search?q=消防车道&topK=8
POST /api/v1/ask                    # {question, scenario: design|research|general, docIds?, topK?}
GET  /api/v1/scenarios              # 场景模板
PATCH /api/v1/settings              # {library, mineru, parser, llm}
GET  /api/v1/documents/:id/content  # canonical document.json
GET  /api/v1/documents/:id/source   # 原 PDF（支持 Range）
```

## 说明

- 解析在本地完成（MinerU），PDF 与解析产物都在本机 `资料库/`，**不入仓库**；
- 检索为纯本地 BM25（无需向量库即可用）；后续可加向量/重排提升召回；
- LLM 仅接收**命中的片段**（非整库），可离线模型（Ollama）以保证数据不外发。
## 已验证（v0.2）

- `npm test`：**31/31 通过**，覆盖桌面外壳、解析转换/顺序/坐标、BM25 检索（命中带页与 bbox）、未配 LLM 的降级检索、**配置 LLM 后的生成式回答与引用保留**、场景模板、界面接线（提问/引用跳转/LLM 配置）；
- 真实 HTTP 端到端：把 `llm` 临时指向本地 OpenAI 兼容桩 → `POST /api/v1/ask` 返回 `mode=llm` 且 8 条引用（含 `p40 · 条文 2`、`p39 · 条文 8.3.2`，带 bbox）；
- 真实库验证：3 本规范、**2272 个内容块**入索引，检索/引用跳转可用（页面右侧 PDF 跳页并高亮命中块）。

### 想复现“生成式回答”

```bash
# 1) 启动本地桩（或换成你的真实 LLM）
node -e "const{createStubLlm}=require('./test/stub-llm-server');createStubLlm().listen(8799).then(p=>console.log('stub',p))"
# 2) 在界面 LLM 接口填：http://127.0.0.1:8799/v1 + 模型名 stub-model（Key 留空）
# 3) 提问即可看到 mode=llm 的回答（引用仍可点开核查）
```
## v0.2 工程版

- **混合检索**：配置 `llm.embeddingModel` 后自动升级为 **BM25 + 向量（RRF 融合）**，向量缓存于 `data/embeddings/`；未配置则纯 BM25；
- **流式问答**：`POST /api/v1/ask/stream`（SSE：`citations` → `delta*` → `done` → `saved`）；
- **会话历史**：`GET /api/v1/conversations[/:id]`，回答与引用可审计；
- **标准化输出**：`schemas/ask-response.schema.json`、`citation.schema.json`、`search-response.schema.json`、`item-export.schema.json`（可用 `GET /schemas/<file>` 拉取）；
- **联动预留**：`GET /api/v1/capabilities`（能力发现）+ `POST /api/v1/export/items`（结构化条目卡片，含条文号与 `locate` 坐标）；
- **桌面发行版**：`npm run build:desktop` 同时生成可选择安装目录的安装程序与单文件免安装程序；桌面窗口自行管理本地服务，无需浏览器。

### 实测（本机）

| 项 | 结果 |
| --- | --- |
| `npm test` | **31/31 通过** |
| 混合检索（桩向量） | `retrieval.mode=hybrid`、`vectors=2272` |
| 问答 | `mode=llm`、引用 8 条、返回 `conversationId` |
| SSE 流式 | 事件 `citations/done/saved` 齐全（`delta` 需真实流式模型） |
| 条目导出 | 918 张卡片，`locate.bbox` 可用 |
| 桌面程序 | 原生窗口可启动，本地服务与窗口生命周期联动，安装版与免安装版均由同一源码生成 |

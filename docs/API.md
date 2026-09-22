# API 契约（v1）

> 平台名：**specflow-design-assistant**；所有响应统一包裹 `{ ok, apiVersion:'v1', data }`。
> Schema 文件位于 `schemas/`，可通过 `GET /schemas/<file>` 直接读取（供外部系统校验）。

## 能力发现

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/capabilities` | 能力、检索模式、schema 与接口清单 |
| GET | `/api/v1/health` | 服务/索引/LLM/向量/会话状态 |

## 检索与问答

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/search?q=&topK=&doc=` | BM25 检索，返回带 `page/itemId/ref/bbox` 的命中 |
| POST | `/api/v1/ask` | 问答：`{question, scenario, retrievalMode, conversationId?, history?, topK?, docIds?, groupId?}` |
| POST | `/api/v1/ask/stream` | SSE 流式问答：事件 `citations` → `delta*` → `done` → `saved` |

`/api/v1/ask` 响应（节选）：

```json
{
  "ok": true, "apiVersion": "v1",
  "data": {
    "mode": "llm",
    "retrievalMode": "auto",
    "grounding": "knowledge",
    "answer": "消防车道净宽度不应小于 4.0m……[1]",
    "scenario": "design",
    "conversationId": "c_9f0c…",
    "retrieval": { "mode": "hybrid", "embeddingModel": "bge-m3", "vectors": 2272, "fused": true },
    "citations": [
      { "n": 1, "docId": "doc_…", "title": "电化学储能电站设计标准", "page": 40,
        "itemId": "p0040-i000123", "type": "text", "ref": "12.2.7",
        "snippet": "…消防车道…净宽度…", "score": 0.031,
        "matched": ["bm25", "vector"],
        "bbox": [110, 555, 318, 570],
        "bboxNormalized": [0.185, 0.32, 0.535, 0.34],
        "locate": { "docId": "doc_…", "page": 40, "itemId": "p0040-i000123", "bbox": [110, 555, 318, 570], "bboxNormalized": [0.185, 0.32, 0.535, 0.34] } }
    ]
  }
}
```

知识来源模式：

- `auto`：先检索资料；有资料时做 RAG，资料不足时仍可使用模型通用知识；
- `knowledge`：严格只依据资料库，无命中时不让模型用常识补齐；
- `general`：不检索资料库，按通用大模型对话；
- `history`：可传最近的 `{role:"user"|"assistant", content:"..."}` 数组，服务端会限长并带入当前轮。
- `conversationId`：继续已有会话；未显式传 `history` 时，服务端会自动恢复该会话最近的多轮上下文；
- `groupId`：只检索指定文档分组。传空字符串表示“未分组”；指定空分组会返回无命中，不会退化成全库搜索；
- `docIds`：只检索指定文档；与 `groupId` 同时出现时以 `docIds` 为准。

## 最近对话

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/conversations?summary=1&limit=40` | 最近对话摘要，适合侧边栏列表 |
| GET | `/api/v1/conversations/:id` | 完整多轮内容、引用与检索范围 |
| DELETE | `/api/v1/conversations/:id` | 删除对话记录，不影响文档 |

## 文档分组

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/groups` | 分组、文档数量与未分组数量 |
| POST | `/api/v1/groups` | 创建分组：`{name}` |
| PATCH | `/api/v1/groups/:id` | 重命名分组：`{name}` |
| DELETE | `/api/v1/groups/:id` | 删除分组；文档回到“未分组”，不删除文件 |
| PATCH | `/api/v1/documents/:id` | 文档归组：`{groupId}`；空字符串表示未分组 |
| GET | `/api/v1/documents?group=<id>` | 只列出指定分组文档 |

## 工程助手

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/workspace` | 返回目录模板与工程项目摘要 |
| PATCH | `/api/v1/workspace` | 更新目录模板：`{defaultFolders: string[]}` |
| POST | `/api/v1/projects` | 创建工程及目录：`{name, baseDirectory, folders?}` |
| GET | `/api/v1/projects/:id` | 项目详情、目录、检查项和完成率 |
| POST | `/api/v1/projects/:id/folders/sync` | 把当前目录模板补充到已有项目 |
| POST | `/api/v1/projects/:id/checklist` | 增加检查项：`{category?, label, required?}` |
| PATCH | `/api/v1/projects/:id/checklist/:itemId` | 更新检查项：`{status:"missing"|"ready"|"na", note?}` |

工程接口可被 Agent 或调度器独立调用。所有目录名会去重并拒绝路径穿越；项目检查进度只统计未标记为“不适用”的项目。

## 规范网站动态监测

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/v1/spec-monitors` | 列出监测任务、状态、下次检查、规范链接与最近变化 |
| POST | `/api/v1/spec-monitors` | 新建并可立即检查：`{name, url, intervalMinutes, keywords?, enabled?, checkNow?}` |
| PATCH | `/api/v1/spec-monitors/:id` | 修改名称、网址、周期、关键词或启停状态 |
| DELETE | `/api/v1/spec-monitors/:id` | 删除任务及其本地检查历史 |
| POST | `/api/v1/spec-monitors/:id/check` | 立即检查一个任务 |
| POST | `/api/v1/spec-monitors/check-all` | 立即检查所有启用任务（最多 3 个并发） |

计划任务只在 SpecFlow 服务运行时执行；服务启动后会补查已经到期的任务。周期范围为 30 分钟至 30 天。抓取器只允许公开 HTTP/HTTPS 地址，解析 DNS 后拒绝环回、链路本地和私网目标，并在每次重定向后重新校验；单次响应限制 5 MB、超时 20 秒。页面有规范链接时以排序后的链接集合生成稳定指纹，没有链接时按正文（非文本响应按原始字节）生成指纹。

## 与设计流程 / 其它系统联动（预留）

1. **定位跳转**：拿 `citations[].locate`（docId + page + itemId + bbox + bboxNormalized）即可在任意阅读器中打开原 PDF 并高亮该块；优先使用左上原点的归一化坐标，避免解析页尺寸与实际 PDF 点尺寸存在偏差；
2. **结构化条目**：`POST /api/v1/export/items` `{docId, itemIds?}` → `item-cards`（含 `ref` 条文号、文本/表格 HTML、`locate`），可直接喂给设计流程做参数核查或生成「规范条目卡片」；
3. **会话回溯**：`GET /api/v1/conversations` / `/{id}`，回答与引用可审计；
4. **能力发现**：外部系统启动时读 `/api/v1/capabilities` 决定是否启用问答/导出。

## 配置（PATCH /api/v1/settings）

```json
{
  "library": "E:\\…\\资料库",
  "mineru": "C:\\…\\mineru.exe",
  "parser": { "backend": "pipeline", "method": "auto", "language": "ch" },
  "llm": { "baseUrl": "https://api.deepseek.com/v1", "model": "deepseek-chat", "apiKey": "sk-…", "embeddingModel": "" }
}
```

- 配置 `embeddingModel` 后，检索自动升级为 **BM25 + 向量混合（RRF 融合）**，向量缓存在 `data/embeddings/`；
- 未配置 `llm` 时 `mode=retrieval`（返回原文片段与引用），平台仍可核查；
- 本地模型：`baseUrl` 用 `http://127.0.0.1:11434/v1`（Ollama）即可离线。

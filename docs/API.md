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
| POST | `/api/v1/ask` | 问答：`{question, scenario: design\|research\|general, topK?, docIds?}` |
| POST | `/api/v1/ask/stream` | SSE 流式问答：事件 `citations` → `delta*` → `done` → `saved` |

`/api/v1/ask` 响应（节选）：

```json
{
  "ok": true, "apiVersion": "v1",
  "data": {
    "mode": "llm",
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
        "locate": { "docId": "doc_…", "page": 40, "itemId": "p0040-i000123", "bbox": [110, 555, 318, 570] } }
    ]
  }
}
```

## 与设计流程 / 其它系统联动（预留）

1. **定位跳转**：拿 `citations[].locate`（docId + page + itemId + bbox）即可在任意阅读器中打开原 PDF 并高亮该块；
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

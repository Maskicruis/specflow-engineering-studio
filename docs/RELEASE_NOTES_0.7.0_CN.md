# SpecFlow Engineering Studio v0.7.0

## 双程序并行运行

- 移除 SpecFlow 内置的 DeepSeek Harness 运行时、WebView、自动启动、3080 端口和余额读取逻辑；
- SpecFlow 与 DeepSeek Harness Studio 可以同时打开，不再争用 Harness 服务或用户配置；
- 安装包不再携带整套 DSH 依赖，职责边界更清晰。

## DeepSeek Harness 连接工具

- 设置中新增“Harness 连接”，可一键安装或更新本地 `@specflow/dsh-knowledge-tools`；
- Harness 新增 `specflow_status`、`specflow_list_groups`、`specflow_search`、`specflow_ask` 四个工具；
- 支持按文档分组或单个文档检索；
- 返回 PDF 页码、条文号、坐标和可点击原文地址；
- SpecFlow 自动向 `%USERPROFILE%\.dsh\integrations\specflow.json` 发布当前实际服务端口。

## 独立使用

- 工程助手保留“智能问答 / 仅资料库 / 通用对话”三种模式；
- 在“模型接口”中配置任意 OpenAI 兼容模型即可脱离 Harness 独立问答；
- 未配置模型时仍可本地检索、阅读 PDF 和定位引用。

## 验证

- 自动化测试 52/52 通过；
- 已在当前 DeepSeek Harness Studio web profile 中完成插件安装和 ESM 加载验证；
- 插件只允许访问本机回环 HTTP 地址。

# SpecFlow Engineering Studio v0.7.1

## 一键工程规范审查

- 新增 DeepSeek Harness 本地 Skill：`/specflow-design-review`；
- 只需提供初步设计文件路径，无需重复编写规范检索和修订提示词；
- 自动检测 SpecFlow 服务、识别规范分组、按章节提取待核查事项并分主题检索；
- 自动生成“符合 / 需修改 / 需要人工复核”审查矩阵、可点击规范引用和替换文本；
- 默认保留原文件，并输出规范审查报告与修订建议；只有存在兼容的文档编辑工具时才生成实际修订副本。

## Harness 集成

- “安装 / 更新集成组件”现在同时安装知识工具插件和审查 Skill；
- Skill 安装到 `%USERPROFILE%\.dsh\skills\specflow-design-review`，工具插件仍安装到 Harness `web` profile；
- 不修改 DeepSeek Harness Studio 源码，不启动第二套 Harness 服务，也不覆盖模型、会话或其他插件；
- 工具插件继续只允许访问本机 `127.0.0.1` / `localhost`。

## 使用方式

```text
/specflow-design-review C:\项目\初步设计.docx
```

可追加范围或分组选项，例如“仅审查消防章节”“使用变电站规范分组”“仅生成审查报告”。

# 客户端更新机制

## 用户操作

1. 打开右上角“设置”；
2. 在“软件更新”中点击“检查更新”；
3. 发现新版本后点击“下载更新”；
4. 安装包通过 SHA-256 校验后，点击“安装并重启”；
5. 按 Windows 安装向导完成覆盖安装。

可关闭“启动后自动检查更新”。自动检查只读取 GitHub Release 元数据，不会自动下载安装包。

## 安全边界

- 更新仓库固定为 `Maskicruis/specflow-engineering-studio`；
- 元数据和安装包只允许 HTTPS；
- 只接受与版本号严格对应的 Windows x64 Setup 文件；
- 下载先写入 `.part` 临时文件；
- 必须匹配 Release 资产摘要或 `SHA256SUMS.txt`，否则拒绝安装；
- 安装必须由用户点击确认，不静默执行。

## 发布者流程

```powershell
npm install
npm test
npm run build:desktop
npm run release:publish
```

发布脚本从 Git Credential Manager 或 `GH_TOKEN` / `GITHUB_TOKEN` 读取凭据，不把令牌写入文件。脚本会生成 `SHA256SUMS.txt`，创建或更新当前版本 Release，并上传 Setup、Portable、blockmap 和校验文件。

版本号、Git 标签、Release 标签和安装包文件名必须一致，例如 `0.4.0` / `v0.4.0` / `SpecFlow-Engineering-Studio-Setup-0.4.0-x64.exe`。

#!/usr/bin/env node
'use strict';

const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const repository = 'Maskicruis/specflow-engineering-studio';
const apiRoot = 'https://api.github.com';
const uploadsRoot = 'https://uploads.github.com';
const version = process.argv[2] || require('../package.json').version;
const metadataOnly = process.argv.includes('--metadata-only');
const tag = `v${version}`;
const releaseDir = path.resolve(__dirname, '..', 'release');

function getToken() {
  if (process.env.GH_TOKEN) return process.env.GH_TOKEN;
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
  try {
    const output = execFileSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8', windowsHide: true
    });
    const line = output.split(/\r?\n/).find(entry => entry.startsWith('password='));
    if (line) return line.slice('password='.length);
  } catch {}
  throw new Error('未找到 GitHub 凭据。请先登录 Git Credential Manager，或设置 GH_TOKEN。');
}

function sha256(filePath) {
  return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex').toUpperCase();
}

function artifactNames() {
  return {
    setup: `SpecFlow-Engineering-Studio-Setup-${version}-x64.exe`,
    blockmap: `SpecFlow-Engineering-Studio-Setup-${version}-x64.exe.blockmap`,
    portable: `SpecFlow-Engineering-Studio-Portable-${version}-x64.exe`
  };
}

function writeChecksums() {
  const names = artifactNames();
  const files = [names.portable, names.setup].filter(name => fs.existsSync(path.join(releaseDir, name)));
  if (!files.length) throw new Error('release/ 中没有找到安装版或便携版构建产物。');
  const content = files.map(name => `${sha256(path.join(releaseDir, name))} *${name}`).join('\n');
  fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), `${content}\n`, 'ascii');
}

async function api(method, url, token, { body, binary } = {}) {
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'specflow-engineering-studio-release', 'X-GitHub-Api-Version': '2022-11-28' };
  const options = { method, headers };
  if (body !== undefined) { headers['Content-Type'] = 'application/json'; options.body = JSON.stringify(body); }
  if (binary !== undefined) { headers['Content-Type'] = 'application/octet-stream'; options.body = binary; }
  const response = await fetch(url, options);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}: ${data?.message || String(text).slice(0, 240)}`);
  return data;
}

function releaseNotes() {
  const names = artifactNames();
  const download = name => `https://github.com/${repository}/releases/download/${tag}/${name}`;
  const detailsPath = path.resolve(__dirname, '..', 'docs', `RELEASE_NOTES_${version}_CN.md`);
  const details = fs.readFileSync(detailsPath, 'utf8').replace(/^# .*\r?\n/, '').replace(/^> .*\r?\n/, '').trim();
  return `## 下载（Windows 10/11 x64）

**推荐安装版：** [${names.setup}](${download(names.setup)})  
可选择安装目录，创建桌面与开始菜单快捷方式，支持以后在客户端内覆盖更新。

**免安装便携版：** [${names.portable}](${download(names.portable)})  
直接运行；适合试用或放在独立工具目录。

完整性校验：[SHA256SUMS.txt](${download('SHA256SUMS.txt')})

> SpecFlow 安装包不内置 MinerU。首次使用请在右上角“设置”中选择实际的 \`mineru.exe\` 并点击“检测”。

---

${details}

## 核心界面

![多轮工程助手与行内引用](https://raw.githubusercontent.com/${repository}/main/docs/assets/engineering-assistant-v0.4.png)

![文档数据库](https://raw.githubusercontent.com/${repository}/main/docs/assets/document-database-v0.3.png)

![PDF 原文定位与高亮](https://raw.githubusercontent.com/${repository}/main/docs/assets/source-review-v0.4.png)

![软件更新设置](https://raw.githubusercontent.com/${repository}/main/docs/assets/software-update-v0.3.png)

---

[完整功能说明](https://github.com/${repository}#readme) · [安装说明](https://github.com/${repository}/blob/main/docs/INSTALL_CN.md) · [更新机制](https://github.com/${repository}/blob/main/docs/UPDATES_CN.md)
`;
}

async function main() {
  const token = getToken();
  const user = await api('GET', `${apiRoot}/user`, token);
  console.log(`以 @${user.login} 发布 ${repository} ${tag}`);
  if (!metadataOnly) writeChecksums();
  const metadata = { name: `SpecFlow Engineering Studio ${tag}`, body: releaseNotes(), draft: false, prerelease: false };
  let release;
  try {
    release = await api('GET', `${apiRoot}/repos/${repository}/releases/tags/${tag}`, token);
    release = await api('PATCH', `${apiRoot}/repos/${repository}/releases/${release.id}`, token, { body: metadata });
    console.log(`已更新 ${tag} 的标题和功能介绍`);
  } catch {
    release = await api('POST', `${apiRoot}/repos/${repository}/releases`, token, { body: { tag_name: tag, target_commitish: 'main', ...metadata } });
    console.log(`已创建 ${tag}`);
  }
  if (metadataOnly) return console.log(`发布页已更新：https://github.com/${repository}/releases/tag/${tag}`);
  const names = artifactNames();
  const files = [names.setup, names.blockmap, names.portable, 'SHA256SUMS.txt'];
  const existing = new Map((release.assets || []).map(asset => [asset.name, asset.id]));
  for (const name of files) {
    const filePath = path.join(releaseDir, name);
    if (!fs.existsSync(filePath)) { console.warn(`跳过缺失资产：${name}`); continue; }
    if (existing.has(name)) {
      await api('DELETE', `${apiRoot}/repos/${repository}/releases/assets/${existing.get(name)}`, token);
    }
    const binary = fs.readFileSync(filePath);
    await api('POST', `${uploadsRoot}/repos/${repository}/releases/${release.id}/assets?name=${encodeURIComponent(name)}`, token, { binary });
    console.log(`已上传 ${name} (${(binary.length / 1048576).toFixed(1)} MB)`);
  }
  console.log(`发布完成：https://github.com/${repository}/releases/tag/${tag}`);
}

main().catch(error => {
  console.error(`发布失败：${error.message}`);
  process.exitCode = 1;
});

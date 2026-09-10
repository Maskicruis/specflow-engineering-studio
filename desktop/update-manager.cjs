'use strict';

const { EventEmitter } = require('node:events');
const { createHash } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const https = require('node:https');
const path = require('node:path');
const { HttpsProxyAgent } = require('https-proxy-agent');

const API_VERSION = '2022-11-28';
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 6;

function resolveProxyUrl() {
  const envProxy = [process.env.HTTPS_PROXY, process.env.https_proxy, process.env.HTTP_PROXY, process.env.http_proxy]
    .find(value => typeof value === 'string' && value.trim());
  if (envProxy) return envProxy.trim();
  if (process.platform !== 'win32') return '';
  try {
    const output = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings', '/v', 'ProxyServer'], {
      encoding: 'utf8', windowsHide: true, timeout: 3000, stdio: ['ignore', 'pipe', 'ignore']
    });
    const match = output.match(/ProxyServer\s+REG_SZ\s+(.+)/i);
    const value = match ? String(match[1]).trim() : '';
    return !value ? '' : (/^https?:\/\//i.test(value) ? value : `http://${value}`);
  } catch {
    return '';
  }
}

function getProxyAgent() {
  const proxy = resolveProxyUrl();
  if (!proxy) return undefined;
  try { return new HttpsProxyAgent(proxy, { keepAlive: false }); } catch { return undefined; }
}

function parseGitHubRepository(value) {
  const source = String(value || '').trim().replace(/\.git$/i, '').replace(/\/$/, '');
  const match = source.match(/^(?:https?:\/\/github\.com\/)?([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/i);
  return match ? { owner: match[1], repo: match[2], slug: `${match[1]}/${match[2]}` } : null;
}

function parseVersion(value) {
  const match = String(value || '').trim().match(/^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  return match ? { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), prerelease: match[4] || '' } : null;
}

function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  if (!a || !b) throw new Error('版本号必须采用 SemVer 格式。');
  for (const key of ['major', 'minor', 'patch']) {
    if (a[key] !== b[key]) return a[key] > b[key] ? 1 : -1;
  }
  if (a.prerelease === b.prerelease) return 0;
  if (!a.prerelease) return 1;
  if (!b.prerelease) return -1;
  return a.prerelease.localeCompare(b.prerelease, 'en', { numeric: true });
}

function selectReleaseAsset(assets, version) {
  const expected = `SpecFlow-Engineering-Studio-Setup-${String(version).replace(/^v/i, '')}-x64.exe`.toLowerCase();
  return (Array.isArray(assets) ? assets : []).find(asset => String(asset?.name || '').toLowerCase() === expected) || null;
}

function parseChecksums(content) {
  const checksums = new Map();
  for (const line of String(content || '').split(/\r?\n/)) {
    const match = line.trim().match(/^([0-9a-f]{64})\s+\*?(.+)$/i);
    if (match) checksums.set(match[2].trim(), match[1].toUpperCase());
  }
  return checksums;
}

function assertHttps(url) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:') throw new Error('更新服务只允许 HTTPS。');
  return parsed;
}

function requestBuffer(url, { headers = {}, maxBytes = MAX_METADATA_BYTES, redirects = MAX_REDIRECTS } = {}) {
  const parsed = assertHttps(url);
  return new Promise((resolve, reject) => {
    const request = https.get(parsed, { headers, agent: getProxyAgent() }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects <= 0) return reject(new Error('更新服务重定向次数过多。'));
        return requestBuffer(new URL(response.headers.location, parsed).toString(), { headers, maxBytes, redirects: redirects - 1 }).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`更新服务返回 HTTP ${response.statusCode}`));
        return;
      }
      const chunks = [];
      let size = 0;
      response.on('data', chunk => {
        size += chunk.length;
        if (size > maxBytes) request.destroy(new Error('更新元数据超过大小限制。'));
        else chunks.push(chunk);
      });
      response.on('end', () => resolve(Buffer.concat(chunks)));
    });
    request.setTimeout(30000, () => request.destroy(new Error('更新服务请求超时。')));
    request.on('error', reject);
  });
}

async function requestJson(url) {
  const buffer = await requestBuffer(url, { headers: {
    accept: 'application/vnd.github+json',
    'user-agent': 'SpecFlow-Engineering-Studio-Updater',
    'x-github-api-version': API_VERSION
  }});
  try { return JSON.parse(buffer.toString('utf8')); } catch { throw new Error('更新服务返回了无效 JSON。'); }
}

function downloadFile(url, filePath, onProgress, redirects = MAX_REDIRECTS) {
  const parsed = assertHttps(url);
  return new Promise((resolve, reject) => {
    const request = https.get(parsed, { headers: { 'user-agent': 'SpecFlow-Engineering-Studio-Updater' }, agent: getProxyAgent() }, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        if (redirects <= 0) return reject(new Error('安装包重定向次数过多。'));
        return downloadFile(new URL(response.headers.location, parsed).toString(), filePath, onProgress, redirects - 1).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        reject(new Error(`安装包下载返回 HTTP ${response.statusCode}`));
        return;
      }
      const total = Number(response.headers['content-length']) || 0;
      let received = 0;
      const hash = createHash('sha256');
      const output = fs.createWriteStream(filePath, { flags: 'wx' });
      response.on('data', chunk => {
        received += chunk.length;
        hash.update(chunk);
        onProgress?.({ received, total, percent: total ? Math.min(100, Math.round(received / total * 1000) / 10) : 0 });
      });
      response.on('aborted', () => output.destroy(new Error('安装包下载连接被中断。')));
      response.on('error', error => output.destroy(error));
      output.on('error', reject);
      output.on('finish', () => resolve({ received, sha256: hash.digest('hex').toUpperCase() }));
      response.pipe(output);
    });
    request.setTimeout(180000, () => request.destroy(new Error('安装包下载超时。')));
    request.on('error', reject);
  });
}

class UpdateManager extends EventEmitter {
  constructor({ currentVersion, repository, updateDir, requestRelease = requestJson, download = downloadFile }) {
    super();
    this.currentVersion = currentVersion;
    this.repository = repository;
    this.updateDir = updateDir;
    this.requestRelease = requestRelease;
    this.downloadFile = download;
    this.downloadPromise = null;
    this.installerLaunched = false;
    this.release = null;
    this.status = { phase: 'idle', message: '尚未检查更新', currentVersion, latestVersion: '', repository, releaseUrl: '', notes: '', progress: 0, downloadedPath: '', checkedAt: '' };
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emit('status', this.getStatus());
    return this.getStatus();
  }

  getStatus() { return { ...this.status }; }

  async check() {
    if (this.downloadPromise) return this.getStatus();
    const parsed = parseGitHubRepository(this.repository);
    if (!parsed) return this.setStatus({ phase: 'unconfigured', message: '更新仓库配置无效。' });
    this.setStatus({ phase: 'checking', message: '正在检查 GitHub Releases…', progress: 0, downloadedPath: '' });
    try {
      const release = await this.requestRelease(`https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/releases/latest`);
      const latestVersion = String(release.tag_name || '').replace(/^v/i, '');
      if (!parseVersion(latestVersion)) throw new Error('最新 Release 的标签不是有效版本号。');
      const common = { latestVersion, releaseUrl: release.html_url || '', checkedAt: new Date().toISOString() };
      if (compareVersions(latestVersion, this.currentVersion) <= 0) {
        this.release = null;
        return this.setStatus({ ...common, phase: 'latest', message: '当前已是最新版本', notes: '' });
      }
      const asset = selectReleaseAsset(release.assets, latestVersion);
      if (!asset?.browser_download_url) throw new Error('最新 Release 中没有 Windows x64 安装包。');
      let expectedHash = String(asset.digest || '').match(/^sha256:([0-9a-f]{64})$/i)?.[1]?.toUpperCase() || '';
      if (!expectedHash) {
        const checksumAsset = (release.assets || []).find(item => /^SHA256SUMS\.txt$/i.test(String(item?.name || '')));
        if (checksumAsset?.browser_download_url) {
          const text = (await requestBuffer(checksumAsset.browser_download_url, { maxBytes: 1024 * 1024 })).toString('utf8');
          expectedHash = parseChecksums(text).get(asset.name) || '';
        }
      }
      this.release = { asset, expectedHash, latestVersion };
      return this.setStatus({ ...common, phase: 'available', message: expectedHash ? `发现新版本 ${latestVersion}` : `发现新版本 ${latestVersion}，但缺少 SHA-256 校验值`, notes: String(release.body || '').slice(0, 6000) });
    } catch (error) {
      this.release = null;
      return this.setStatus({ phase: 'error', message: error.message || String(error), checkedAt: new Date().toISOString() });
    }
  }

  download() {
    if (this.downloadPromise) return this.downloadPromise;
    this.downloadPromise = this.downloadOnce();
    this.downloadPromise.finally(() => { this.downloadPromise = null; }).catch(() => {});
    return this.downloadPromise;
  }

  async downloadOnce() {
    if (!this.release) await this.check();
    if (!this.release || this.status.phase !== 'available') return this.getStatus();
    if (!this.release.expectedHash) return this.setStatus({ phase: 'error', message: '为安全起见，缺少 SHA-256 校验值时不会下载安装包。' });
    fs.mkdirSync(this.updateDir, { recursive: true });
    const finalPath = path.join(this.updateDir, path.basename(this.release.asset.name));
    const partialPath = `${finalPath}.part`;
    for (const candidate of [partialPath, finalPath]) if (fs.existsSync(candidate)) fs.unlinkSync(candidate);
    this.setStatus({ phase: 'downloading', message: `正在下载 ${this.release.latestVersion}…`, progress: 0, downloadedPath: '' });
    try {
      const result = await this.downloadFile(this.release.asset.browser_download_url, partialPath, ({ percent }) => {
        this.setStatus({ phase: 'downloading', progress: percent, message: `正在下载 ${this.release.latestVersion}… ${percent.toFixed(1)}%` });
      });
      if (result.sha256 !== this.release.expectedHash) throw new Error('SHA-256 校验失败');
      fs.renameSync(partialPath, finalPath);
      return this.setStatus({ phase: 'downloaded', message: `版本 ${this.release.latestVersion} 已下载并通过 SHA-256 校验`, progress: 100, downloadedPath: finalPath });
    } catch (error) {
      if (fs.existsSync(partialPath)) fs.unlinkSync(partialPath);
      return this.setStatus({ phase: 'error', message: error.message || String(error), progress: 0, downloadedPath: '' });
    }
  }

  install() {
    if (this.downloadPromise) throw new Error('更新仍在下载中，请等待下载完成。');
    const installer = this.status.downloadedPath;
    if (!installer || !fs.existsSync(installer)) throw new Error('尚未下载可安装的更新。');
    if (this.installerLaunched) return { launched: false, alreadyLaunched: true, path: installer };
    const child = spawn(installer, [], { detached: true, stdio: 'ignore', windowsHide: false });
    child.unref();
    this.installerLaunched = true;
    return { launched: true, path: installer };
  }
}

module.exports = { UpdateManager, compareVersions, downloadFile, parseChecksums, parseGitHubRepository, parseVersion, requestBuffer, requestJson, selectReleaseAsset };

'use strict';

const { EventEmitter } = require('node:events');
const { spawn, spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const READY_MARKERS = ['DeepSeek Harness', '<div id="root"></div>'];
const MANAGED_SKILL_MARKER = '<!-- managed-by-specflow-engineering-studio -->';

function firstExisting(candidates) {
  return candidates.find(candidate => candidate && fs.existsSync(candidate)) || '';
}

function executableFromWhere(name) {
  if (process.platform !== 'win32') return name;
  const result = spawnSync('where.exe', [name], { encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) return '';
  return String(result.stdout || '').split(/\r?\n/).map(line => line.trim()).find(Boolean) || '';
}

function projectRoot() {
  return path.resolve(__dirname, '..');
}

function resolveDshHome() {
  return path.resolve(process.env.DSH_HOME || path.join(os.homedir(), '.dsh'));
}

function resolveNodeExecutable() {
  const root = projectRoot();
  return firstExisting([
    process.env.SPECFLOW_DSH_NODE,
    process.resourcesPath && path.join(process.resourcesPath, 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
    path.join(root, 'assets', 'runtime', process.platform === 'win32' ? 'node.exe' : 'node'),
    process.platform === 'win32' && process.env.ProgramFiles ? path.join(process.env.ProgramFiles, 'nodejs', 'node.exe') : '',
    executableFromWhere('node')
  ]);
}

function resolveDshCli() {
  const root = projectRoot();
  return firstExisting([
    process.env.SPECFLOW_DSH_CLI,
    path.join(root, 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    path.join(resolveDshHome(), 'profiles', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js')
  ]);
}

function probeHarness(port, timeout = 1200) {
  return new Promise(resolve => {
    const request = http.get({ hostname: '127.0.0.1', port, path: '/', timeout }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { if (body.length < 8192) body += chunk; });
      response.on('end', () => resolve({
        ready: response.statusCode === 200 && READY_MARKERS.some(marker => body.includes(marker)),
        occupied: true,
        statusCode: response.statusCode
      }));
    });
    request.on('timeout', () => { request.destroy(); resolve({ ready: false, occupied: false }); });
    request.on('error', error => resolve({ ready: false, occupied: error.code !== 'ECONNREFUSED', error: error.message }));
  });
}

function callHarness(port, method, payload, timeout = 5000) {
  if (!/^[A-Za-z0-9._-]+$/.test(method)) return Promise.reject(new Error('无效的 Harness 方法：' + method));
  const rpcId = randomUUID();
  const body = JSON.stringify({ type: 'client-request', rpcId, method, payload });
  return new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port, path: '/api/' + method, method: 'POST', timeout,
      headers: { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) }
    }, response => {
      let responseBody = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { responseBody += chunk; });
      response.on('end', () => {
        if (response.statusCode !== 200) return reject(new Error('Harness API ' + method + ' 返回 HTTP ' + response.statusCode));
        try {
          const envelope = JSON.parse(responseBody);
          if (envelope.rpcId !== rpcId) throw new Error('Harness API 响应标识不匹配');
          resolve(envelope.result);
        } catch (error) { reject(error); }
      });
    });
    request.on('timeout', () => request.destroy(new Error('Harness API ' + method + ' 请求超时')));
    request.on('error', reject);
    request.end(body);
  });
}

function ensureKnowledgeSkill({ dshHome = resolveDshHome(), baseUrl }) {
  const skillDir = path.join(dshHome, 'skills', 'specflow-knowledge-base');
  const skillFile = path.join(skillDir, 'SKILL.md');
  if (fs.existsSync(skillFile)) {
    const existing = fs.readFileSync(skillFile, 'utf8');
    if (!existing.includes(MANAGED_SKILL_MARKER)) return { installed: false, preserved: true, path: skillFile };
  }
  const content = `${MANAGED_SKILL_MARKER}
---
name: specflow-knowledge-base
description: Query the local SpecFlow engineering document database and preserve auditable PDF citations.
---

# SpecFlow engineering knowledge base

Use this skill when the user asks about imported engineering standards, clauses, tables, design parameters, or requests evidence from local PDFs.

The local API base is \`${baseUrl}\`.

1. Discover capabilities with \`GET ${baseUrl}/api/v1/capabilities\`.
2. Search with \`GET ${baseUrl}/api/v1/search?q=<encoded query>&topK=8\`.
3. For a grounded answer, call \`POST ${baseUrl}/api/v1/ask\` with JSON \`{"question":"...","retrievalMode":"knowledge","scenario":"design"}\`.
4. When the user names a project or discipline group, list groups with \`GET ${baseUrl}/api/v1/groups\`, then pass its exact \`groupId\` to \`/api/v1/ask\`.
5. Continue a prior knowledge conversation by passing its \`conversationId\`; the service restores recent history when explicit \`history\` is omitted.
6. Preserve every returned citation number, document title, page, clause reference, \`sourceUrl\`, and \`locate\` object. Never invent citations.
7. Use \`retrievalMode:"auto"\` only when the user permits general knowledge in addition to the database.

The service listens only on the local computer. If it is unavailable, tell the user to open SpecFlow Engineering Studio.
`;
  fs.mkdirSync(skillDir, { recursive: true });
  const temporary = skillFile + '.tmp';
  fs.writeFileSync(temporary, content, 'utf8');
  fs.renameSync(temporary, skillFile);
  return { installed: true, preserved: false, path: skillFile };
}

async function ensureWorkspaceRegistered(port, workspace, options = {}) {
  const resolved = path.resolve(workspace);
  fs.mkdirSync(resolved, { recursive: true });
  const attempts = Math.max(1, Number(options.attempts) || 16);
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const result = await callHarness(port, 'workspace.create', { path: resolved });
      if (!result?.ok) {
        const detail = result?.error ? result.error.code + ': ' + result.error.message : '未知错误';
        throw new Error('Harness 项目注册失败：' + detail);
      }
      return result.value.workspace;
    } catch (error) {
      lastError = error;
      if (attempt + 1 < attempts) await new Promise(resolve => setTimeout(resolve, Number(options.delayMs) || 350));
    }
  }
  throw lastError || new Error('Harness 项目注册失败');
}

class HarnessRuntime extends EventEmitter {
  constructor(options = {}) {
    super();
    this.port = Number(options.port) || 3080;
    this.workspace = path.resolve(options.workspace || path.join(os.homedir(), 'Documents', 'SpecFlow Engineering Studio', 'Agent Workspace'));
    this.knowledgeBaseUrl = String(options.knowledgeBaseUrl || 'http://127.0.0.1:8790');
    this.child = null;
    this.external = false;
    this.stopping = false;
    this.logs = [];
    this.status = { phase: 'idle', message: '等待启动', url: '', pid: null, version: '0.1.0-rc.7' };
  }

  configure(options = {}) {
    if (options.port) this.port = Number(options.port) || this.port;
    if (options.workspace) this.workspace = path.resolve(options.workspace);
    if (options.knowledgeBaseUrl) this.knowledgeBaseUrl = String(options.knowledgeBaseUrl);
  }

  setStatus(patch) {
    this.status = { ...this.status, ...patch };
    this.emit('status', this.getStatus());
  }

  log(message, level = 'info') {
    const clean = String(message || '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').trim();
    if (!clean) return;
    this.logs.push({ time: new Date().toISOString(), level, message: clean });
    if (this.logs.length > 200) this.logs.shift();
  }

  getStatus() { return { ...this.status, logs: this.logs.slice(-40), port: this.port, workspace: this.workspace }; }
  getPaths() { return { node: resolveNodeExecutable(), cli: resolveDshCli(), dshHome: resolveDshHome() }; }

  async registerWorkspace(workspace) {
    const registered = await ensureWorkspaceRegistered(this.port, workspace);
    this.workspace = registered.path;
    this.log('已注册项目：' + registered.path);
    return registered;
  }

  async start(options = {}) {
    if (this.child || this.status.phase === 'starting' || this.status.phase === 'running') return this.getStatus();
    this.configure(options);
    const url = 'http://127.0.0.1:' + this.port;
    this.setStatus({ phase: 'starting', message: '正在启动 DeepSeek Harness…', url, pid: null });
    ensureKnowledgeSkill({ baseUrl: this.knowledgeBaseUrl });

    const existing = await probeHarness(this.port);
    if (existing.ready) {
      this.external = true;
      await ensureWorkspaceRegistered(this.port, this.workspace).catch(error => this.log(error.message, 'warn'));
      this.setStatus({ phase: 'running', message: '已连接现有 Harness', url, pid: null });
      return this.getStatus();
    }
    if (existing.occupied) {
      this.setStatus({ phase: 'error', message: '端口 ' + this.port + ' 已被其他程序占用', url: '', pid: null });
      return this.getStatus();
    }

    const node = resolveNodeExecutable();
    const cli = resolveDshCli();
    if (!node || !cli) {
      const missing = [!node && 'Node.js 运行时', !cli && 'DeepSeek Harness'].filter(Boolean).join('、');
      this.setStatus({ phase: 'error', message: '未找到' + missing + '，请重新安装完整版本', url: '', pid: null });
      return this.getStatus();
    }

    fs.mkdirSync(this.workspace, { recursive: true });
    this.external = false;
    this.stopping = false;
    this.log('启动：dsh web --port ' + this.port);
    const child = spawn(node, [cli, 'web', '--port', String(this.port)], {
      cwd: this.workspace,
      env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', SPECFLOW_KB_URL: this.knowledgeBaseUrl },
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    this.child = child;
    this.setStatus({ pid: child.pid || null });
    child.stdout.on('data', data => this.log(data));
    child.stderr.on('data', data => this.log(data, 'warn'));
    child.on('error', error => {
      this.child = null;
      this.log(error.message, 'error');
      this.setStatus({ phase: 'error', message: 'Harness 启动失败：' + error.message, pid: null });
    });
    child.on('exit', (code, signal) => {
      const expected = this.stopping;
      this.child = null;
      this.stopping = false;
      if (!expected) this.setStatus({ phase: code === 0 ? 'idle' : 'error', message: code === 0 ? 'Harness 已停止' : 'Harness 异常退出（' + (code ?? signal ?? 'unknown') + '）', pid: null });
    });

    const deadline = Date.now() + Math.max(5000, Math.min(Number(options.timeoutMs) || 120000, 120000));
    while (Date.now() < deadline && this.child === child) {
      const probe = await probeHarness(this.port, 1500);
      if (probe.ready) {
        await ensureWorkspaceRegistered(this.port, this.workspace).catch(error => this.log(error.message, 'warn'));
        this.setStatus({ phase: 'running', message: 'DeepSeek Harness 已就绪', url, pid: child.pid || null });
        return this.getStatus();
      }
      await new Promise(resolve => setTimeout(resolve, 550));
    }
    if (this.child === child) this.setStatus({ phase: 'error', message: 'Harness 启动超时，请检查运行日志', pid: child.pid || null });
    return this.getStatus();
  }

  async stop() {
    if (this.external) {
      this.external = false;
      this.setStatus({ phase: 'idle', message: '已断开外部 Harness', pid: null });
      return;
    }
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    child.kill();
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 4000);
      child.once('exit', () => { clearTimeout(timer); resolve(); });
    });
    if (this.child === child && process.platform === 'win32' && child.pid) {
      spawnSync('taskkill.exe', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
      this.child = null;
    }
    this.setStatus({ phase: 'idle', message: 'Harness 已停止', pid: null });
  }

  async restart(options = {}) {
    await this.stop();
    this.configure(options);
    return this.start();
  }
}

module.exports = {
  HarnessRuntime, callHarness, ensureKnowledgeSkill, ensureWorkspaceRegistered,
  firstExisting, probeHarness, resolveDshCli, resolveDshHome, resolveNodeExecutable
};

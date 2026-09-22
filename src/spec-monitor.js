'use strict';

const crypto = require('node:crypto');
const dns = require('node:dns').promises;
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { ensureDir, nowIso, readJson, writeJson } = require('./utils');

const MIN_INTERVAL_MINUTES = 30;
const MAX_INTERVAL_MINUTES = 30 * 24 * 60;
const MAX_RESPONSE_BYTES = 5 * 1024 * 1024;
const DEFAULT_KEYWORDS = ['标准', '规范', '规程', '导则', '指南', '公告', '发布', '更新', 'GB', 'DL', 'NB', 'standard', 'specification', '.pdf'];

function hash(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function decodeEntities(value) {
  return String(value || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCodePoint(Number(code)));
}

function plainText(html) {
  return decodeEntities(String(html || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKeywords(value) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[\n,，;；]+/);
  return Array.from(new Set(source.map(item => String(item || '').trim()).filter(Boolean))).slice(0, 30);
}

function extractSpecificationEntries(html, pageUrl, keywords = []) {
  const selected = keywords.length ? normalizeKeywords(keywords) : DEFAULT_KEYWORDS;
  const result = [];
  const seen = new Set();
  const anchorPattern = /<a\b([^>]*?)href\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = anchorPattern.exec(String(html || '')))) {
    const href = decodeEntities(match[2] || match[3] || match[4] || '').trim();
    if (!href || /^(?:javascript|mailto|tel|data):/i.test(href) || href.startsWith('#')) continue;
    let absolute;
    try { absolute = new URL(href, pageUrl).href; } catch { continue; }
    const label = plainText(match[6]).slice(0, 240) || path.basename(new URL(absolute).pathname) || absolute;
    const parsedLink = new URL(absolute);
    const haystack = `${label} ${parsedLink.pathname} ${parsedLink.search}`.toLowerCase();
    if (!selected.some(keyword => haystack.includes(String(keyword).toLowerCase()))) continue;
    const key = `${label}\n${absolute}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push({ title: label, url: absolute });
    }
  }
  return result.sort((left, right) => left.url.localeCompare(right.url) || left.title.localeCompare(right.title)).slice(0, 500);
}

function pageTitle(html, fallback) {
  const match = String(html || '').match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return (match ? plainText(match[1]) : String(fallback || '')).slice(0, 200);
}

function isPrivateAddress(address) {
  const value = String(address || '').toLowerCase().replace(/^::ffff:/, '');
  if (net.isIPv4(value)) {
    const parts = value.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      parts[0] >= 224;
  }
  if (net.isIPv6(value)) return value === '::1' || value === '::' || value.startsWith('fc') || value.startsWith('fd') || value.startsWith('fe8') || value.startsWith('fe9') || value.startsWith('fea') || value.startsWith('feb');
  return true;
}

function normalizeUrl(value) {
  let parsed;
  try { parsed = new URL(String(value || '').trim()); } catch { throw new Error('请输入有效的网站地址'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('只支持 HTTP 或 HTTPS 网站');
  if (parsed.username || parsed.password) throw new Error('监测地址不能包含用户名或密码');
  if (!parsed.hostname || /^(?:localhost|.+\.localhost|.+\.local)$/i.test(parsed.hostname)) throw new Error('不能监测本机或局域网地址');
  if (net.isIP(parsed.hostname) && isPrivateAddress(parsed.hostname)) throw new Error('不能监测本机或局域网地址');
  parsed.hash = '';
  return parsed.href;
}

function intervalMinutes(value) {
  const minutes = Number(value || 24 * 60);
  if (!Number.isFinite(minutes) || minutes < MIN_INTERVAL_MINUTES || minutes > MAX_INTERVAL_MINUTES) {
    throw new Error(`检查周期应为 ${MIN_INTERVAL_MINUTES}–${MAX_INTERVAL_MINUTES} 分钟`);
  }
  return Math.round(minutes);
}

function diffEntries(previous = [], next = []) {
  const before = new Map(previous.map(item => [`${item.title}\n${item.url}`, item]));
  const after = new Map(next.map(item => [`${item.title}\n${item.url}`, item]));
  return {
    added: Array.from(after.entries()).filter(([key]) => !before.has(key)).map(([, value]) => value).slice(0, 50),
    removed: Array.from(before.entries()).filter(([key]) => !after.has(key)).map(([, value]) => value).slice(0, 50)
  };
}

class SpecificationMonitor {
  constructor({ dataDir, fetchImpl = globalThis.fetch, resolveHost, autoStart = true, pollIntervalMs = 60000 } = {}) {
    this.file = path.join(ensureDir(dataDir), 'specification-monitors.json');
    this.fetchImpl = fetchImpl;
    this.resolveHost = resolveHost || (hostname => dns.lookup(hostname, { all: true, verbatim: true }));
    const stored = readJson(this.file, {});
    this.items = Array.isArray(stored.items) ? stored.items : [];
    this.running = new Map();
    this.firstTimer = null;
    this.timer = null;
    this.persist();
    if (autoStart) this.start(pollIntervalMs);
  }

  persist() { writeJson(this.file, { schemaVersion: 1, items: this.items }); }

  publicItem(item) {
    return {
      id: item.id, name: item.name, url: item.url, intervalMinutes: item.intervalMinutes,
      enabled: item.enabled !== false, keywords: item.keywords || [], title: item.title || '', status: item.status || 'pending',
      lastCheckedAt: item.lastCheckedAt || '', lastChangedAt: item.lastChangedAt || '', nextCheckAt: this.nextCheckAt(item),
      consecutiveFailures: Number(item.consecutiveFailures || 0), lastError: item.lastError || '',
      entries: Array.isArray(item.entries) ? item.entries : [], lastChanges: item.lastChanges || { added: [], removed: [] },
      history: Array.isArray(item.history) ? item.history.slice(0, 30) : []
    };
  }

  list() { return { items: this.items.map(item => this.publicItem(item)), running: Array.from(this.running.keys()) }; }

  get(id) {
    const item = this.items.find(entry => entry.id === String(id || ''));
    if (!item) throw new Error('规范网站监测项不存在');
    return item;
  }

  create(payload = {}) {
    const name = String(payload.name || '').trim();
    if (!name) throw new Error('请输入监测名称');
    const now = nowIso();
    const item = {
      id: 'mon_' + crypto.randomUUID(), name: name.slice(0, 100), url: normalizeUrl(payload.url),
      intervalMinutes: intervalMinutes(payload.intervalMinutes), enabled: payload.enabled !== false,
      keywords: normalizeKeywords(payload.keywords), title: '', status: 'pending', contentHash: '', etag: '', lastModified: '',
      lastCheckedAt: '', lastChangedAt: '', consecutiveFailures: 0, lastError: '', entries: [], lastChanges: { added: [], removed: [] },
      history: [], createdAt: now, updatedAt: now
    };
    this.items.unshift(item);
    this.persist();
    return this.publicItem(item);
  }

  update(id, patch = {}) {
    const item = this.get(id);
    if (patch.name !== undefined) {
      const name = String(patch.name || '').trim();
      if (!name) throw new Error('请输入监测名称');
      item.name = name.slice(0, 100);
    }
    if (patch.url !== undefined) {
      const next = normalizeUrl(patch.url);
      if (next !== item.url) {
        item.url = next; item.contentHash = ''; item.etag = ''; item.lastModified = ''; item.entries = []; item.status = 'pending';
      }
    }
    if (patch.intervalMinutes !== undefined) item.intervalMinutes = intervalMinutes(patch.intervalMinutes);
    if (patch.enabled !== undefined) item.enabled = Boolean(patch.enabled);
    if (patch.keywords !== undefined) {
      const nextKeywords = normalizeKeywords(patch.keywords);
      if (JSON.stringify(nextKeywords) !== JSON.stringify(item.keywords || [])) {
        item.keywords = nextKeywords;
        item.contentHash = '';
        item.entries = [];
        item.lastChanges = { added: [], removed: [] };
        item.status = 'pending';
      }
    }
    item.updatedAt = nowIso();
    this.persist();
    return this.publicItem(item);
  }

  remove(id) {
    const index = this.items.findIndex(entry => entry.id === String(id || ''));
    if (index < 0) throw new Error('规范网站监测项不存在');
    const [removed] = this.items.splice(index, 1);
    this.persist();
    return { id: removed.id, removed: true };
  }

  nextCheckAt(item) {
    if (item.enabled === false || !item.lastCheckedAt) return '';
    return new Date(new Date(item.lastCheckedAt).getTime() + Number(item.intervalMinutes || 1440) * 60000).toISOString();
  }

  due(item, timestamp = Date.now()) {
    if (item.enabled === false || this.running.has(item.id)) return false;
    if (!item.lastCheckedAt) return true;
    return timestamp >= new Date(item.lastCheckedAt).getTime() + Number(item.intervalMinutes || 1440) * 60000;
  }

  async assertPublic(url) {
    const parsed = new URL(normalizeUrl(url));
    const addresses = await this.resolveHost(parsed.hostname);
    const list = Array.isArray(addresses) ? addresses : [addresses];
    if (!list.length || list.some(entry => isPrivateAddress(entry.address || entry))) throw new Error('监测地址解析到本机或局域网，已拒绝访问');
  }

  async fetchPage(item) {
    let target = item.url;
    for (let redirects = 0; redirects <= 4; redirects += 1) {
      await this.assertPublic(target);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20000);
      try {
        const headers = { Accept: 'text/html,application/xhtml+xml,text/plain,application/pdf;q=0.8,*/*;q=0.2', 'User-Agent': 'SpecFlow-Engineering-Studio/Specification-Monitor' };
        if (item.etag) headers['If-None-Match'] = item.etag;
        if (item.lastModified) headers['If-Modified-Since'] = item.lastModified;
        const response = await this.fetchImpl(target, { headers, redirect: 'manual', signal: controller.signal });
        if (response.status >= 300 && response.status < 400 && response.headers.get('location')) {
          target = new URL(response.headers.get('location'), target).href;
          continue;
        }
        if (response.status === 304) return { notModified: true, response, target };
        if (!response.ok) throw new Error(`网站返回 HTTP ${response.status}`);
        const declared = Number(response.headers.get('content-length') || 0);
        if (declared > MAX_RESPONSE_BYTES) throw new Error('网站响应超过 5 MB 限制');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > MAX_RESPONSE_BYTES) throw new Error('网站响应超过 5 MB 限制');
        return { notModified: false, response, target, buffer };
      } finally { clearTimeout(timer); }
    }
    throw new Error('网站重定向次数过多');
  }

  async check(id) {
    const item = this.get(id);
    if (this.running.has(item.id)) return this.running.get(item.id);
    const operation = this.checkItem(item).finally(() => this.running.delete(item.id));
    this.running.set(item.id, operation);
    return operation;
  }

  async checkItem(item) {
    const checkedAt = nowIso();
    try {
      const fetched = await this.fetchPage(item);
      if (fetched.notModified) {
        item.status = 'unchanged'; item.lastCheckedAt = checkedAt; item.lastError = ''; item.consecutiveFailures = 0;
        item.history.unshift({ checkedAt, changed: false, summary: '服务器确认内容未更新' });
      } else {
        const contentType = String(fetched.response.headers.get('content-type') || '').toLowerCase();
        const isText = /html|xml|text|json/.test(contentType);
        const html = isText ? fetched.buffer.toString('utf8') : '';
        const entries = isText || /<html|<a\b/i.test(html) ? extractSpecificationEntries(html, fetched.target, item.keywords) : [];
        const normalizedText = isText ? plainText(html).slice(0, 1024 * 1024) : '';
        const fingerprintSource = entries.length ? JSON.stringify(entries) : normalizedText || fetched.buffer;
        const contentHash = hash(fingerprintSource);
        const baseline = !item.contentHash;
        const changed = !baseline && item.contentHash !== contentHash;
        const changes = diffEntries(item.entries, entries);
        item.title = pageTitle(html, item.name);
        item.contentHash = contentHash;
        item.etag = fetched.response.headers.get('etag') || '';
        item.lastModified = fetched.response.headers.get('last-modified') || '';
        item.entries = entries;
        item.lastChanges = changed ? changes : { added: [], removed: [] };
        item.status = baseline ? 'baseline' : changed ? 'changed' : 'unchanged';
        item.lastCheckedAt = checkedAt;
        if (changed) item.lastChangedAt = checkedAt;
        item.lastError = ''; item.consecutiveFailures = 0;
        const summary = baseline ? `已建立基线，识别 ${entries.length} 条规范链接` : changed ? `发现变化：新增 ${changes.added.length} 条，移除 ${changes.removed.length} 条` : '未发现规范内容变化';
        item.history.unshift({ checkedAt, changed, summary, added: changes.added.length, removed: changes.removed.length });
      }
    } catch (error) {
      item.status = 'error'; item.lastCheckedAt = checkedAt; item.lastError = error?.name === 'AbortError' ? '网站检查超时' : String(error.message || error);
      item.consecutiveFailures = Number(item.consecutiveFailures || 0) + 1;
      item.history.unshift({ checkedAt, changed: false, error: item.lastError, summary: item.lastError });
    }
    item.history = item.history.slice(0, 50);
    item.updatedAt = checkedAt;
    this.persist();
    return this.publicItem(item);
  }

  async checkDue() {
    return this.checkMany(this.items.filter(item => this.due(item)));
  }

  async checkAll() {
    return this.checkMany(this.items.filter(item => item.enabled !== false));
  }

  async checkMany(items) {
    const results = [];
    for (let index = 0; index < items.length; index += 3) {
      results.push(...await Promise.all(items.slice(index, index + 3).map(item => this.check(item.id))));
    }
    return results;
  }

  start(pollIntervalMs = 60000) {
    if (this.timer) return;
    this.firstTimer = setTimeout(() => { this.firstTimer = null; this.checkDue().catch(() => {}); }, 3000);
    if (typeof this.firstTimer.unref === 'function') this.firstTimer.unref();
    this.timer = setInterval(() => this.checkDue().catch(() => {}), Math.max(30000, Number(pollIntervalMs) || 60000));
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  stop() {
    if (this.firstTimer) clearTimeout(this.firstTimer);
    if (this.timer) clearInterval(this.timer);
    this.firstTimer = null;
    this.timer = null;
  }
}

module.exports = {
  DEFAULT_KEYWORDS,
  SpecificationMonitor,
  diffEntries,
  extractSpecificationEntries,
  intervalMinutes,
  isPrivateAddress,
  normalizeUrl
};

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { SpecificationMonitor, extractSpecificationEntries, normalizeUrl } = require('../src/spec-monitor');

function response(html, headers = {}) {
  const body = Buffer.from(html, 'utf8');
  return {
    status: 200,
    ok: true,
    headers: new Headers({ 'content-type': 'text/html; charset=utf-8', 'content-length': String(body.length), ...headers }),
    arrayBuffer: async () => body
  };
}

test('extracts specification links and ignores unrelated navigation', () => {
  const entries = extractSpecificationEntries('<a href="/a.pdf">GB 50000 设计规范</a><a href="/about">关于我们</a>', 'https://standards.example/list');
  assert.deepEqual(entries, [{ title: 'GB 50000 设计规范', url: 'https://standards.example/a.pdf' }]);
  assert.throws(() => normalizeUrl('http://127.0.0.1/admin'), /局域网/);
});

test('creates a baseline then reports added specification links', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-monitor-'));
  let html = '<title>标准发布</title><a href="/a.pdf">GB 50000 设计规范</a>';
  try {
    const monitor = new SpecificationMonitor({
      dataDir: temporary,
      autoStart: false,
      resolveHost: async () => [{ address: '203.0.113.10' }],
      fetchImpl: async () => response(html)
    });
    const created = monitor.create({ name: '国家标准', url: 'https://standards.example/list', intervalMinutes: 60 });
    const baseline = await monitor.check(created.id);
    assert.equal(baseline.status, 'baseline');
    assert.equal(baseline.entries.length, 1);
    html += '<a href="/b.pdf">GB 50001 新发布规范</a>';
    const changed = await monitor.check(created.id);
    assert.equal(changed.status, 'changed');
    assert.equal(changed.lastChanges.added.length, 1);
    assert.equal(changed.lastChanges.added[0].url, 'https://standards.example/b.pdf');
    assert.equal(monitor.due(monitor.get(created.id), Date.now()), false);
    const reconfigured = monitor.update(created.id, { keywords: '新发布' });
    assert.equal(reconfigured.status, 'pending');
    assert.equal(reconfigured.entries.length, 0);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('rejects DNS results that point to private networks', async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-monitor-private-'));
  try {
    const monitor = new SpecificationMonitor({ dataDir: temporary, autoStart: false, resolveHost: async () => [{ address: '192.168.1.10' }], fetchImpl: async () => response('') });
    const item = monitor.create({ name: '不安全地址', url: 'https://example.test/specs' });
    const checked = await monitor.check(item.id);
    assert.equal(checked.status, 'error');
    assert.match(checked.lastError, /局域网/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

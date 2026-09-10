'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');

test('embedded browser scripts are syntactically valid', () => {
  const scripts = [...html.matchAll(/<script(?:\s+type="module")?>([\s\S]*?)<\/script>/g)].map(match => match[1]);
  assert.equal(scripts.length, 2);
  new vm.Script(scripts[0]);
  new vm.Script(scripts[1].replace(/^import .*?;\s*/m, 'const pdfjs={GlobalWorkerOptions:{}};'));
});

test('viewer contains the compatibility fallback and aligned overlay wrapper', () => {
  assert.match(html, /typeof vp\.convertToViewportRectangle/);
  assert.match(html, /mapPoint\(bb\[0\],bb\[1\]\)/);
  assert.match(html, /\.cvwrap\{[^}]*width:max-content/);
  assert.match(html, /function safeTableHtml/);
  assert.match(html, /function showParserState/);
  assert.match(html, /尚未安装或配置 MinerU/);
});

test('workspace shell keeps the primary workflow focused and accessible', () => {
  assert.match(html, /class="app-shell"/);
  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /<textarea id="q"/);
  assert.match(html, /data-page="database"/);
  assert.match(html, /data-workspace-page="assistant"/);
  assert.match(html, /data-workspace-page="database"/);
  assert.match(html, /id="dbSearch"/);
  assert.match(html, /class="drop-zone"/);
  assert.match(html, /function toggleTheme/);
  assert.match(html, /Shift \+ Enter 换行/);
  assert.match(html, /refreshScopeOptions/);
  assert.match(html, /id="servicePort"/);
  assert.match(html, /id="parserBackend"/);
  assert.match(html, /id="parseTables"/);
  assert.match(html, /id="llmEmbed"/);
  assert.match(html, /function clearLlmKey/);
  assert.match(html, /function renderUpdateStatus/);
  assert.match(html, /id="autoCheckUpdates"/);
});

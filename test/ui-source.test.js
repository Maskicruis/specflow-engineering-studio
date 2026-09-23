'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');
const workspaceScript = fs.readFileSync(path.join(__dirname, '..', 'ui-modules', 'workspace.js'), 'utf8');
const slopeCore = fs.readFileSync(path.join(__dirname, '..', 'ui-modules', 'road-slope-core.js'), 'utf8');
const slopeToolHtml = fs.readFileSync(path.join(__dirname, '..', 'ui-tools', 'road-slope.html'), 'utf8');
const slopeToolScript = fs.readFileSync(path.join(__dirname, '..', 'ui-tools', 'road-slope-window.js'), 'utf8');

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
  assert.match(html, /function fitPage/);
  assert.match(html, /page\.view/);
  assert.match(html, /hlNormalized/);
  assert.match(html, /loadVersion/);
  assert.match(html, /cache:'no-store'/);
  assert.match(html, /retryViewer/);
  assert.match(html, /openCitationFromLocation/);
  assert.match(html, /top:45px;z-index:300/);
  assert.match(html, /关闭阅读器/);
});

test('workspace shell keeps the primary workflow focused and accessible', () => {
  assert.match(html, /class="app-shell"/);
  assert.match(html, /aria-label="主导航"/);
  assert.match(html, /<textarea id="q"/);
  assert.match(html, /data-page="database"/);
  assert.match(html, /data-workspace-page="assistant"/);
  assert.doesNotMatch(html, /data-workspace-page="agent"/);
  assert.doesNotMatch(html, /id="harnessView"/);
  assert.match(html, /function renderConnectorStatus/);
  assert.match(html, /function installConnector/);
  assert.match(html, /\/specflow-design-review/);
  assert.match(html, /Plugin \+ Skill/);
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
  assert.match(html, /id="qMode"/);
  assert.match(html, /id="chatMessages"/);
  assert.match(html, /function clearLlmKey/);
  assert.match(html, /function renderUpdateStatus/);
  assert.match(html, /id="autoCheckUpdates"/);
  assert.match(html, /class="settings-nav"/);
  assert.match(html, /data-settings-pane="parser"/);
  assert.match(html, /data-settings-pane="model"/);
  assert.match(html, /data-settings-pane="integration"/);
  assert.match(html, /data-settings-pane="updates"/);
  assert.match(html, /function selectSettingsTab/);
});

test('engineering workspace launches the road drainage designer in its own tool window', () => {
  new vm.Script(workspaceScript);
  new vm.Script(slopeCore);
  new vm.Script(slopeToolScript);
  assert.match(html, /设计助手/);
  assert.match(html, /工具工作台/);
  assert.match(html, /id="projectName"/);
  assert.match(html, /id="checklistList"/);
  assert.doesNotMatch(html, /id="slopeCanvas"/);
  assert.match(slopeToolHtml, /id="slopeCanvas"/);
  assert.match(slopeToolHtml, /id="slopeDecimals"/);
  assert.match(slopeToolHtml, /独立工具窗口/);
  assert.match(workspaceScript, /function createEngineeringProject/);
  assert.match(workspaceScript, /function openRoadSlopeWindow/);
  assert.match(workspaceScript, /function launchDesignTool/);
  assert.match(workspaceScript, /DESKTOP\.designTools\.openWindow\(tool\.id\)/);
  assert.match(workspaceScript, /function renderDesignToolCatalog/);
  assert.match(workspaceScript, /ctrlKey&&event\.altKey/);
  assert.match(workspaceScript, /DESKTOP\.balance\.get/);
  assert.match(html, /id="specMonitorDialog"/);
  assert.match(workspaceScript, /function loadSpecMonitors/);
  assert.match(slopeToolScript, /selectionBox/);
  assert.match(slopeToolScript, /lastActivation/);
  assert.match(slopeToolScript, /edgeDistance/);
  assert.match(slopeCore, /function calculateNetwork/);
  assert.match(slopeCore, /function segmentNodeKeys/);
  assert.match(slopeCore, /function normalizeSegments/);
  assert.match(slopeToolScript, /function orientNode/);
  assert.match(slopeToolHtml, /连接两节点/);
  assert.doesNotMatch(slopeToolScript, /road-edge-chevron/);
});

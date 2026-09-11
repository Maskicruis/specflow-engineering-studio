'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const main = fs.readFileSync(path.join(root, 'desktop', 'main.cjs'), 'utf8');
const preload = fs.readFileSync(path.join(root, 'desktop', 'preload.cjs'), 'utf8');
const ui = fs.readFileSync(path.join(root, 'ui.html'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('desktop shell owns the service and uses a native frameless window', () => {
  assert.match(main, /createHttpServer/);
  assert.match(main, /new BrowserWindow/);
  assert.match(main, /frame:\s*false/);
  assert.match(main, /contextIsolation:\s*true/);
  assert.match(main, /nodeIntegration:\s*false/);
  assert.match(main, /webviewTag:\s*true/);
  assert.match(main, /EADDRINUSE/);
});

test('desktop bridge exposes only bounded window and picker operations', () => {
  assert.match(preload, /contextBridge\.exposeInMainWorld\('specflowDesktop'/);
  assert.match(preload, /chooseDirectory/);
  assert.match(preload, /toggleMaximize/);
  assert.match(preload, /updates:\s*\{/);
  assert.match(preload, /setAutoCheck/);
  assert.match(preload, /harness:\s*\{/);
  assert.match(preload, /balance:\s*\{/);
  assert.doesNotMatch(preload, /require:\s*require/);
});

test('desktop shell integrates the bounded DeepSeek Harness workspace', () => {
  assert.match(main, /new HarnessRuntime/);
  assert.match(main, /will-attach-webview/);
  assert.match(main, /balance:get/);
  assert.match(ui, /data-workspace-page="agent"/);
  assert.match(ui, /id="harnessView"/);
  assert.match(ui, /data-page="agent"/);
  assert.match(ui, /id="balanceLabel"/);
  assert.equal(pkg.dependencies['@deepseek-ai/dsh'], '0.1.0-rc.7');
});

test('desktop layout has titlebar, runtime status and settings drawer', () => {
  assert.match(ui, /class="desktop-titlebar"/);
  assert.match(ui, /id="desktopRuntime"/);
  assert.match(ui, /class="drawer-backdrop"/);
  assert.match(ui, /data-act="winClose"/);
  assert.equal(pkg.build.extraMetadata.main, 'desktop/main.cjs');
  assert.equal(pkg.build.productName, 'SpecFlow Engineering Studio');
  assert.equal(pkg.build.win.icon, 'build/app.ico');
  assert.equal(pkg.build.nsis.runAfterFinish, true);
});

test('desktop shell provides verified GitHub Release updates', () => {
  assert.match(main, /new UpdateManager/);
  assert.match(main, /updates:download/);
  assert.match(main, /desktop-preferences\.json/);
  assert.match(ui, /id="updateState"/);
  assert.match(ui, /安装并重启/);
  assert.match(ui, /SHA-256/);
});

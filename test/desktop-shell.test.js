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
  assert.match(main, /webviewTag:\s*false/);
  assert.match(main, /EADDRINUSE/);
});

test('desktop bridge exposes only bounded window and picker operations', () => {
  assert.match(preload, /contextBridge\.exposeInMainWorld\('specflowDesktop'/);
  assert.match(preload, /chooseDirectory/);
  assert.match(preload, /toggleMaximize/);
  assert.match(preload, /updates:\s*\{/);
  assert.match(preload, /setAutoCheck/);
  assert.match(preload, /connector:\s*\{/);
  assert.match(preload, /connector:install/);
  assert.match(preload, /balance:\s*\{/);
  assert.match(preload, /designTools:\s*\{/);
  assert.match(preload, /chooseProjectDirectory/);
  assert.match(preload, /project:open-directory/);
  assert.doesNotMatch(preload, /harness:\s*\{/);
  assert.doesNotMatch(preload, /require:\s*require/);
});

test('desktop shell integrates balance, project folders and external design tools', () => {
  assert.match(main, /fetchDeepSeekBalance/);
  assert.match(main, /new DesignToolRegistry/);
  assert.match(main, /dialog:choose-project-directory/);
  assert.match(main, /design-tools:launch/);
  assert.match(ui, /id="balanceTitleButton"/);
  assert.match(ui, /data-workspace-page="design"/);
  assert.match(ui, /data-workspace-page="tools"/);
  assert.ok(pkg.build.files.includes('ui-modules/**/*'));
});

test('desktop shell connects to external DeepSeek Harness without hosting a second runtime', () => {
  assert.match(main, /installConnector/);
  assert.match(main, /writeDiscovery/);
  assert.match(main, /specflow:open-citation/);
  assert.match(main, /openCitationInMain/);
  assert.doesNotMatch(main, /new HarnessRuntime/);
  assert.doesNotMatch(main, /will-attach-webview/);
  assert.doesNotMatch(ui, /id="harnessView"/);
  assert.match(ui, /data-settings-pane="integration"/);
  assert.match(ui, /id="modelTitleLabel"/);
  assert.equal(pkg.dependencies['@deepseek-ai/dsh'], undefined);
  assert.ok(pkg.build.files.includes('packages/dsh-specflow-knowledge/**/*'));
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

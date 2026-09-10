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
  assert.match(main, /EADDRINUSE/);
});

test('desktop bridge exposes only bounded window and picker operations', () => {
  assert.match(preload, /contextBridge\.exposeInMainWorld\('specflowDesktop'/);
  assert.match(preload, /chooseDirectory/);
  assert.match(preload, /toggleMaximize/);
  assert.doesNotMatch(preload, /require:\s*require/);
});

test('desktop layout has titlebar, runtime status and settings drawer', () => {
  assert.match(ui, /class="desktop-titlebar"/);
  assert.match(ui, /id="desktopRuntime"/);
  assert.match(ui, /class="drawer-backdrop"/);
  assert.match(ui, /data-act="winClose"/);
  assert.equal(pkg.build.extraMetadata.main, 'desktop/main.cjs');
  assert.equal(pkg.build.productName, 'SpecFlow Engineering Studio');
});

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { PACKAGE_NAME, connectorStatus, discoveryPath, installConnector, writeDiscovery } = require('../desktop/harness-connector.cjs');

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value), 'utf8');
}

test('writes a loopback discovery record for the external Harness connector', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-connector-discovery-'));
  try {
    const target = writeDiscovery({ baseUrl: 'http://127.0.0.1:43210', pid: 42 }, { dshHome: root });
    assert.equal(target, discoveryPath(root));
    assert.deepEqual(JSON.parse(fs.readFileSync(target, 'utf8')), { version: 1, baseUrl: 'http://127.0.0.1:43210', pid: 42 });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('detects an installed and enabled SpecFlow DSH plugin', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-connector-status-'));
  try {
    writeJson(path.join(root, 'profiles', 'web', 'package.json'), { dependencies: { [PACKAGE_NAME]: 'file:test' }, dsh: { profile: { bundles: [PACKAGE_NAME] } } });
    writeJson(path.join(root, 'profiles', 'web', 'node_modules', '@specflow', 'dsh-knowledge-tools', 'package.json'), { name: PACKAGE_NAME, version: '0.7.0' });
    const status = connectorStatus({ dshHome: root });
    assert.equal(status.installed, true);
    assert.equal(status.version, '0.7.0');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('installs the self-contained connector without launching a second Harness runtime', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-connector-install-'));
  try {
    const manifestPath = path.join(root, 'profiles', 'web', 'package.json');
    writeJson(manifestPath, { name: 'dsh-profile-web', private: true, dependencies: {}, dsh: { profile: { bundles: ['@deepseek-ai/dsh-base'] } } });
    const status = await installConnector({ dshHome: root });
    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    assert.equal(status.installed, true);
    assert.match(manifest.dependencies[PACKAGE_NAME], /^file:/);
    assert.ok(manifest.dsh.profile.bundles.includes(PACKAGE_NAME));
    assert.ok(fs.existsSync(path.join(root, 'profiles', 'web', 'node_modules', '@specflow', 'dsh-knowledge-tools', 'cordis.patch.yml')));
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

test('connector package registers grounded SpecFlow tools', () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'packages', 'dsh-specflow-knowledge', 'lib', 'index.js'), 'utf8');
  assert.match(source, /name: 'specflow_status'/);
  assert.match(source, /name: 'specflow_list_groups'/);
  assert.match(source, /name: 'specflow_search'/);
  assert.match(source, /name: 'specflow_ask'/);
  assert.match(source, /sourceUrl/);
  assert.match(source, /loopback HTTP addresses only/);
});

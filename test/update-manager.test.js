'use strict';

const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { UpdateManager, compareVersions, parseChecksums, parseGitHubRepository, selectReleaseAsset } = require('../desktop/update-manager.cjs');

test('updater parses repository and semantic versions', () => {
  assert.deepEqual(parseGitHubRepository('Maskicruis/specflow-engineering-studio'), { owner: 'Maskicruis', repo: 'specflow-engineering-studio', slug: 'Maskicruis/specflow-engineering-studio' });
  assert.deepEqual(parseGitHubRepository('https://github.com/Maskicruis/specflow-engineering-studio.git'), { owner: 'Maskicruis', repo: 'specflow-engineering-studio', slug: 'Maskicruis/specflow-engineering-studio' });
  assert.equal(compareVersions('0.10.0', '0.9.9'), 1);
  assert.equal(compareVersions('0.3.0-beta.1', '0.3.0'), -1);
});

test('updater selects only the expected signed installer name', () => {
  const installer = { name: 'SpecFlow-Engineering-Studio-Setup-0.3.0-x64.exe' };
  assert.equal(selectReleaseAsset([{ name: 'portable.exe' }, installer], '0.3.0'), installer);
  const digest = 'A'.repeat(64);
  assert.equal(parseChecksums(`${digest} *${installer.name}\n`).get(installer.name), digest);
});

test('update download is single-flight and SHA-256 verified', async () => {
  const updateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-update-test-'));
  const payload = Buffer.from('verified SpecFlow installer');
  const digest = createHash('sha256').update(payload).digest('hex').toUpperCase();
  let downloads = 0;
  let releaseDownload;
  const gate = new Promise(resolve => { releaseDownload = resolve; });
  const manager = new UpdateManager({
    currentVersion: '0.2.0',
    repository: 'Maskicruis/specflow-engineering-studio',
    updateDir,
    download: async (_url, filePath, onProgress) => {
      downloads += 1;
      await gate;
      fs.writeFileSync(filePath, payload);
      onProgress({ percent: 100 });
      return { received: payload.length, sha256: digest };
    }
  });
  manager.release = {
    asset: { name: 'SpecFlow-Engineering-Studio-Setup-0.3.0-x64.exe', browser_download_url: 'https://github.com/Maskicruis/specflow-engineering-studio/releases/download/v0.3.0/setup.exe' },
    expectedHash: digest,
    latestVersion: '0.3.0'
  };
  manager.status.phase = 'available';
  const first = manager.download();
  const second = manager.download();
  assert.equal(first, second);
  await Promise.resolve();
  assert.equal(downloads, 1);
  assert.throws(() => manager.install(), /仍在下载中/);
  releaseDownload();
  const status = await first;
  assert.equal(status.phase, 'downloaded');
  assert.equal(fs.readFileSync(status.downloadedPath, 'utf8'), payload.toString());
  fs.rmSync(updateDir, { recursive: true, force: true });
});

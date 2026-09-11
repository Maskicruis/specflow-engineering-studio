'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { fetchDeepSeekBalance, readDshApiKey } = require('../desktop/deepseek-balance.cjs');

test('reads the API key from the official DSH credentials file', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-balance-'));
  try {
    fs.mkdirSync(path.join(home, '.dsh'), { recursive: true });
    fs.writeFileSync(path.join(home, '.dsh', '.credentials.yaml'), 'DEEPSEEK_API_KEY: test-secret\n', 'utf8');
    assert.equal(readDshApiKey({ home }), 'test-secret');
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('queries DeepSeek balance without returning the API key', async () => {
  let authorization = '';
  const result = await fetchDeepSeekBalance({
    apiKey: 'private-value',
    fetchImpl: async (_url, options) => {
      authorization = options.headers.Authorization;
      return { ok: true, json: async () => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '12.34' }] }) };
    }
  });
  assert.equal(authorization, 'Bearer private-value');
  assert.equal(result.ok, true);
  assert.equal(result.balanceInfos[0].total_balance, '12.34');
  assert.equal(JSON.stringify(result).includes('private-value'), false);
});

test('reports an unconfigured balance without making a request', async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-balance-empty-'));
  try {
    const result = await fetchDeepSeekBalance({ home, fetchImpl: async () => { throw new Error('must not be called'); } });
    assert.equal(result.ok, false);
    assert.equal(result.configured, false);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

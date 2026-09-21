'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { fetchDeepSeekBalance, readDshApiKey } = require('../desktop/deepseek-balance.cjs');

test('reads quoted DeepSeek keys from the external Harness credential file', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-balance-'));
  try {
    const file = path.join(temporary, '.credentials.yaml');
    fs.writeFileSync(file, "DEEPSEEK_API_KEY: 'sk-test-value'\n", 'utf8');
    assert.equal(readDshApiKey({ credentialsPath: file }), 'sk-test-value');
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('fetches balance without exposing the API key in the result', async () => {
  const result = await fetchDeepSeekBalance({
    apiKey: 'sk-secret',
    fetchImpl: async (_url, options) => {
      assert.equal(options.headers.Authorization, 'Bearer sk-secret');
      return { ok: true, json: async () => ({ is_available: true, balance_infos: [{ currency: 'CNY', total_balance: '12.34' }] }) };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(result.balanceInfos[0].total_balance, '12.34');
  assert.equal(JSON.stringify(result).includes('sk-secret'), false);
});

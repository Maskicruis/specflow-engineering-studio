'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function unquote(value) {
  const text = String(value || '').trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) return text.slice(1, -1);
  return text;
}

function readDshApiKey(options = {}) {
  if (String(options.apiKey || '').trim()) return String(options.apiKey).trim();
  const credentialsPath = options.credentialsPath || path.join(options.home || os.homedir(), '.dsh', '.credentials.yaml');
  try {
    const source = fs.readFileSync(credentialsPath, 'utf8');
    const match = source.match(/^\s*(?:DEEPSEEK_API_KEY|deepseek_api_key)\s*:\s*(.+?)\s*$/m);
    return match ? unquote(match[1].replace(/\s+#.*$/, '')) : '';
  } catch { return ''; }
}

async function fetchDeepSeekBalance(options = {}) {
  const apiKey = readDshApiKey(options);
  if (!apiKey) return { ok: false, configured: false, message: 'Harness 尚未配置 DeepSeek API Key' };
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(1000, Number(options.timeoutMs) || 15000));
  try {
    const response = await fetchImpl('https://api.deepseek.com/user/balance', {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: controller.signal
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { ok: false, configured: true, message: data?.error?.message || `HTTP ${response.status}` };
    return {
      ok: true,
      configured: true,
      isAvailable: data.is_available === true,
      balanceInfos: Array.isArray(data.balance_infos) ? data.balance_infos : [],
      checkedAt: new Date().toISOString()
    };
  } catch (error) {
    return { ok: false, configured: true, message: error?.name === 'AbortError' ? '余额查询超时' : error?.message || String(error) };
  } finally { clearTimeout(timer); }
}

module.exports = { fetchDeepSeekBalance, readDshApiKey };

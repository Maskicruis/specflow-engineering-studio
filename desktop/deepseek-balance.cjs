'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const YAML = require('yaml');

function readDshApiKey(options = {}) {
  if (String(options.apiKey || '').trim()) return String(options.apiKey).trim();
  const home = options.home || os.homedir();
  const credentialsPath = path.join(home, '.dsh', '.credentials.yaml');
  try {
    if (!fs.existsSync(credentialsPath)) return '';
    const parsed = YAML.parse(fs.readFileSync(credentialsPath, 'utf8'));
    return String(parsed?.DEEPSEEK_API_KEY || parsed?.deepseek_api_key || '').trim();
  } catch { return ''; }
}

async function fetchDeepSeekBalance(options = {}) {
  const apiKey = readDshApiKey(options);
  if (!apiKey) return { ok: false, configured: false, message: '未配置 DeepSeek API Key（Harness 设置或 ~/.dsh/.credentials.yaml）' };
  const fetchImpl = options.fetchImpl || fetch;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(options.timeoutMs) || 15000);
  try {
    const response = await fetchImpl('https://api.deepseek.com/user/balance', {
      headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
      signal: controller.signal
    });
    const data = await response.json();
    if (!response.ok) return { ok: false, configured: true, message: data?.error?.message || 'HTTP ' + response.status };
    return {
      ok: true,
      configured: true,
      isAvailable: data.is_available === true,
      balanceInfos: Array.isArray(data.balance_infos) ? data.balance_infos : []
    };
  } catch (error) {
    return { ok: false, configured: true, message: error?.name === 'AbortError' ? '查询超时' : error?.message || String(error) };
  } finally { clearTimeout(timer); }
}

module.exports = { fetchDeepSeekBalance, readDshApiKey };

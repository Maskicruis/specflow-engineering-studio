'use strict';
/** LLM 接入层：OpenAI 兼容 /chat/completions（可对接 DeepSeek、vLLM、Ollama、任意兼容服务） */
function normalizeBase(baseUrl) {
  let b = String(baseUrl || '').trim();
  if (!b) return '';
  b = b.replace(/\/+$/, '');
  if (!/\/v1$/.test(b) && !/\/chat\/completions$/.test(b)) b += '/v1';
  return b;
}
function isConfigured(llm) {
  const c = llm || {};
  return !!(String(c.baseUrl || '').trim() && String(c.model || '').trim());
}
async function chat(llm, messages, options = {}) {
  const cfg = llm || {};
  if (!isConfigured(cfg)) return { ok: false, error: '未配置 LLM（请在设置中填写 baseUrl 与 model）', code: 'LLM_NOT_CONFIGURED' };
  const url = normalizeBase(cfg.baseUrl) + '/chat/completions';
  const body = { model: cfg.model, messages, temperature: options.temperature == null ? 0.2 : options.temperature, stream: false };
  const headers = { 'Content-Type': 'application/json' };
  if (String(cfg.apiKey || '').trim()) headers.Authorization = 'Bearer ' + String(cfg.apiKey).trim();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(cfg.timeoutMs) || 120000);
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal });
    const text = await res.text();
    if (!res.ok) return { ok: false, error: 'HTTP ' + res.status + ' ' + text.slice(0, 300), code: 'LLM_HTTP_ERROR' };
    let data; try { data = JSON.parse(text); } catch { return { ok: false, error: '响应不是合法 JSON', code: 'LLM_BAD_RESPONSE' }; }
    const content = data && data.choices && data.choices[0] && data.choices[0].message ? data.choices[0].message.content : '';
    return { ok: true, content: String(content || ''), usage: data.usage || null };
  } catch (error) {
    return { ok: false, error: error && error.name === 'AbortError' ? '请求超时' : String(error && error.message || error), code: 'LLM_REQUEST_FAILED' };
  } finally { clearTimeout(timer); }
}
/** 流式对话：SSE 逐块回调 onDelta(text) */
async function chatStream(llm, messages, onDelta, options = {}) {
  const cfg = llm || {};
  if (!isConfigured(cfg)) return { ok: false, error: '未配置 LLM（请在设置中填写 baseUrl 与 model）', code: 'LLM_NOT_CONFIGURED' };
  const url = normalizeBase(cfg.baseUrl) + '/chat/completions';
  const body = { model: cfg.model, messages, temperature: options.temperature == null ? 0.2 : options.temperature, stream: true };
  const headers = { 'Content-Type': 'application/json' };
  if (String(cfg.apiKey || '').trim()) headers.Authorization = 'Bearer ' + String(cfg.apiKey).trim();
  try {
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok || !res.body) { const text = await res.text().catch(() => ''); return { ok: false, error: 'HTTP ' + res.status + ' ' + String(text).slice(0, 200), code: 'LLM_HTTP_ERROR' }; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = ''; let full = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop();
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices && json.choices[0] && json.choices[0].delta ? json.choices[0].delta.content : '';
          if (delta) { full += delta; if (onDelta) onDelta(delta); }
        } catch { /* 忽略非 JSON 行 */ }
      }
    }
    return { ok: true, content: full };
  } catch (error) {
    return { ok: false, error: String(error && error.message || error), code: 'LLM_REQUEST_FAILED' };
  }
}

module.exports = { chat, chatStream, isConfigured, normalizeBase };
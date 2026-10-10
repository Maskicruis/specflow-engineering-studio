'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const guide = require('../ui-tools/word-format-guide');
const source = fs.readFileSync(path.join(__dirname, '../ui-tools/word-format-window.js'), 'utf8');
const markup = fs.readFileSync(path.join(__dirname, '../ui-tools/word-format.html'), 'utf8');
const available = { installed: true, vbaAccess: true, version: '16.0', llmConfigured: false };

function ui(options = {}) {
  const elements = new Map(), calls = [], feeds = [];
  function element(id) {
    if (!elements.has(id)) {
      const classes = new Set();
      elements.set(id, { id, hidden: !!markup.match(new RegExp('id="' + id + '"[^>]* hidden')), textContent: '', innerHTML: '', value: id === 'wordMode' ? 'vba' : '', checked: false, disabled: false, dataset: {}, rows: [], attributes: {},
        classList: { toggle(key, value) { if (value) classes.add(key); else classes.delete(key); }, add(...keys) { keys.forEach(key => classes.add(key)); }, remove(...keys) { keys.forEach(key => classes.delete(key)); }, contains(key) { return classes.has(key); } },
        listeners: {}, addEventListener(type, fn) { this.listeners[type] = fn; },
        setAttribute(key, value) { this.attributes[key] = value; }, removeAttribute(key) { delete this.attributes[key]; },
        closest() { return element('banner'); }, querySelectorAll() { return this.rows; }, click() { this.clicked = true; }
      });
    }
    return elements.get(id);
  }
  const document = { getElementById: element, addEventListener() {}, documentElement: element('root') };
  class Feed { constructor(url) { this.url = url; this.closed = false; feeds.push(this); } close() { this.closed = true; } send(event) { this.onmessage({ data: JSON.stringify(event) }); } }
  const context = { document, window: { WordFormatGuide: guide, addEventListener() {} }, localStorage: { setItem() {} }, EventSource: Feed, confirm: () => true,
    fetch: async (url, request) => {
      calls.push({ url, request, body: request?.headers?.['Content-Type'] === 'application/json' ? JSON.parse(request.body) : null });
      let data;
      if (url.endsWith('/status')) data = options.environment || available;
      else if (url.endsWith('/files')) data = { id: 'wf_1', name: request.body.name, size: request.body.size };
      else if (url.endsWith('/jobs') && request) data = { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', mode: JSON.parse(request.body).mode, state: 'queued' };
      else if (url.endsWith('/jobs')) data = { items: [] };
      else if (url.endsWith('/apply')) data = { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', state: 'queued', mode: 'vba-llm' };
      else throw Error('Unexpected test URL ' + url);
      return { ok: true, json: async () => ({ ok: true, data }) };
    }
  };
  vm.runInNewContext(source, context);
  const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
  const event = async (id, type, extra = {}) => { await element(id).listeners[type]({ preventDefault() {}, ...extra }); await settle(); };
  const upload = async () => { element('wordFile').files = [{ name: '工程.docx', size: 1024 }]; await event('wordFile', 'change'); };
  return { element, calls, feeds, event, settle, upload };
}

test('Word guide covers every preparation blocker and never grants consent', () => {
  const base = { file: {}, environment: available, mode: 'vba', confirmVba: true };
  assert.equal(guide.readiness(base).ready, true);
  for (const change of [{ file: null }, { busy: true }, { checking: true }, { environment: null }, { environment: { installed: false } }, { environment: { installed: true, vbaAccess: false } }, { confirmVba: false }, { mode: 'vba-llm' }]) assert.equal(guide.readiness({ ...base, ...change }).ready, false);
  const llm = { ...base, mode: 'vba-llm', environment: { ...available, llmConfigured: true } };
  assert.match(guide.readiness(llm).hint, /发送到模型/);
  assert.equal(guide.readiness({ ...llm, confirmLlm: true }).ready, true);
  assert.equal(guide.readiness({ ...base, job: { state: 'formatting' } }).step, 3);
  assert.equal(guide.readiness({ ...base, job: { state: 'awaiting-review' } }).step, 3);
  assert.equal(guide.readiness({ ...base, job: { state: 'completed' } }).step, 4);
  assert.equal(guide.readiness({ ...base, job: { state: 'error' } }).ready, false);
});

test('Word guided UI automatically detects environment and defaults to local-only formatting', async () => {
  const app = ui(); await app.settle();
  assert.equal(app.calls.filter(x => x.url.endsWith('/status')).length, 1);
  assert.equal(app.element('wordMode').value, 'vba');
  assert.equal(app.element('llmConsentField').hidden, true);
  assert.equal(app.element('startWord').disabled, true);
  assert.match(app.element('wordNextHint').textContent, /选择文件/);
  await app.upload();
  assert.match(app.element('wordNextHint').textContent, /允许执行/);
  assert.equal(app.element('startWord').disabled, true);
  assert.equal(app.element('confirmWordVba').checked, false);
  app.element('confirmWordVba').checked = true; await app.event('confirmWordVba', 'change');
  assert.equal(app.element('startWord').disabled, false);
  await app.event('startWord', 'click');
  const request = app.calls.find(x => x.url.endsWith('/jobs') && x.body);
  assert.equal(request.body.confirmLlm, false); assert.equal(request.body.mode, 'vba');
  assert.equal(app.element('startWord').disabled, true);
  assert.equal(app.element('chooseWordFile').disabled, true);
  await app.event('startWord', 'click');
  assert.equal(app.calls.filter(x => x.url.endsWith('/jobs') && x.body).length, 1);
  app.feeds[0].send({ job: { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', state: 'completed', outputUrl: '/output', reportUrl: '/report' } });
  await app.settle();
  assert.equal(app.element('wordCompleted').hidden, false);
  assert.match(app.element('wordNextHint').textContent, /下载标准化/);
  assert.equal(app.element('downloadWord').href, '/output');
  assert.equal(app.feeds[0].closed, true);
  await app.event('newWordTask', 'click');
  assert.equal(app.element('confirmWordVba').checked, false);
  assert.equal(app.element('wordWelcome').hidden, false);
  assert.equal(app.element('startWord').disabled, true);
});

test('Word UI explains model configuration and lets local-only formatting proceed without a model', async () => {
  const app = ui(); await app.settle(); await app.upload();
  app.element('confirmWordVba').checked = true;
  app.element('wordMode').value = 'vba-llm'; await app.event('wordMode', 'change');
  assert.equal(app.element('llmConsentField').hidden, false);
  assert.match(app.element('wordNextHint').textContent, /配置模型/);
  assert.equal(app.element('startWord').disabled, true);
  app.element('wordMode').value = 'vba'; await app.event('wordMode', 'change');
  assert.equal(app.element('startWord').disabled, false);
  await app.event('wordHelpToggle', 'click');
  assert.equal(app.element('wordHelp').hidden, false);
  assert.equal(app.element('wordHelpToggle').attributes['aria-expanded'], 'true');
  await app.event('wordHelpToggle', 'click');
  assert.equal(app.element('wordHelp').hidden, true);
});

test('Word UI empty model plans still offer explicit review and full VBA formatting', async () => {
  const app = ui({ environment: { ...available, llmConfigured: true } }); await app.settle(); await app.upload();
  app.element('wordMode').value = 'vba-llm'; app.element('confirmWordVba').checked = true; app.element('confirmWordLlm').checked = true;
  await app.event('wordMode', 'change'); await app.event('startWord', 'click');
  app.feeds[0].send({ job: { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', mode: 'vba-llm', state: 'awaiting-review', plan: [] } });
  await app.settle();
  assert.equal(app.element('wordReview').hidden, false);
  assert.equal(app.element('wordReviewTable').hidden, true);
  assert.match(app.element('wordReviewHint').textContent, /仍可/);
  assert.equal(app.element('startWord').disabled, true);
  await app.event('applyWordPlan', 'click');
  const request = app.calls.find(x => x.url.endsWith('/apply'));
  assert.deepEqual(request.body.changes, []);
  assert.equal(request.body.confirmApply, true);
  assert.equal(request.body.confirmTextEdits, false);
});

test('Word UI sends layout choices and never replaces front matter before explicit range confirmation', async () => {
  const app = ui(); await app.settle(); await app.upload();
  app.element('wordCoverMode').value = 'standard'; app.element('wordCoverTitle').value = '初步设计说明书';
  app.element('wordRebuildToc').checked = true; app.element('wordImageCells').checked = true;
  app.element('confirmWordVba').checked = true;
  await app.event('wordCoverMode', 'change'); await app.event('startWord', 'click');
  const submitted = app.calls.find(x => x.url.endsWith('/jobs') && x.body).body;
  assert.equal(submitted.layout.cover.mode, 'standard'); assert.equal(submitted.layout.imageCells, true);
  app.feeds[0].send({ job: { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', state: 'awaiting-review', plan: [], layout: submitted.layout,
    frontMatter: { cover: { first: 1, last: 5, preview: ['<script>旧封面</script>'] }, toc: null, warnings: [] } } });
  assert.equal(app.element('wordLayoutReview').hidden, false);
  assert.doesNotMatch(app.element('wordLayoutSummary').innerHTML, /<script>/);
  assert.equal(app.element('applyWordPlan').disabled, true);
  await app.event('applyWordPlan', 'click'); assert.equal(app.calls.some(x => x.url.endsWith('/apply')), false);
  app.element('confirmWordLayout').checked = true; await app.event('confirmWordLayout', 'change');
  assert.equal(app.element('applyWordPlan').disabled, false);
  await app.event('applyWordPlan', 'click');
  assert.equal(app.calls.find(x => x.url.endsWith('/apply')).body.confirmLayout, true);
});

test('Word UI requires separate text-edit consent and does not auto-apply suggestions', async () => {
  const app = ui({ environment: { ...available, llmConfigured: true } }); await app.settle(); await app.upload();
  app.element('wordMode').value = 'vba-llm'; app.element('confirmWordVba').checked = true; app.element('confirmWordLlm').checked = true;
  await app.event('wordMode', 'change'); await app.event('startWord', 'click');
  app.feeds[0].send({ job: { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', state: 'awaiting-review', plan: [{ index: 1, role: 'body', originalText: '<script>untrusted</script>', replacement: '建议', selected: false, reason: '检查' }] } });
  assert.doesNotMatch(app.element('wordPlanRows').innerHTML, /<script>/);
  const fields = { '.plan-selected': { checked: true }, '.plan-role': { value: 'body' }, '.plan-text': { checked: true } };
  app.element('wordPlanRows').rows = [{ dataset: { planIndex: '1' }, querySelector: key => fields[key] }];
  await app.event('wordPlanRows', 'change');
  assert.equal(app.element('applyWordPlan').disabled, true);
  await app.event('applyWordPlan', 'click');
  assert.equal(app.calls.some(x => x.url.endsWith('/apply')), false);
  app.element('confirmWordText').checked = true; await app.event('confirmWordText', 'change');
  assert.equal(app.element('applyWordPlan').disabled, false);
  await app.event('applyWordPlan', 'click');
  assert.equal(app.calls.find(x => x.url.endsWith('/apply')).body.confirmTextEdits, true);
});

test('Word UI shows actionable task failure and preserves the uploaded copy for a conscious retry', async () => {
  const app = ui(); await app.settle(); await app.upload();
  app.element('confirmWordVba').checked = true; await app.event('confirmWordVba', 'change'); await app.event('startWord', 'click');
  app.feeds[0].send({ type: 'progress', message: 'Loading the trusted VBA module' });
  assert.match(app.element('wordProgressText').textContent, /随附 VBA/);
  app.feeds[0].send({ job: { id: 'wj_1', fileId: 'wf_1', name: '工程.docx', state: 'error', error: 'VBA_ACCESS_DISABLED' } });
  assert.equal(app.element('wordJobError').hidden, false);
  assert.match(app.element('wordJobErrorHint').textContent, /信任对 VBA/);
  await app.event('retryWordTask', 'click');
  assert.equal(app.element('wordJobError').hidden, true);
  assert.equal(app.element('startWord').disabled, false);
  assert.equal(app.calls.filter(x => x.url.endsWith('/jobs') && x.body).length, 1);
});

test('Word guide gives specific remedies and safely labels English VBA progress', () => {
  assert.match(guide.errorHint('protected document'), /解除保护/);
  assert.match(guide.errorHint('unresolved revisions'), /已有修订/);
  assert.match(guide.errorHint('LLM HTTP 429'), /只统一格式/);
  assert.match(guide.errorHint('Word 未安装或无法启动'), /首次启动/);
  assert.match(guide.progress('Formatting body ranges'), /正在执行排版步骤/);
  assert.equal(guide.progress('正在处理表格'), '正在处理表格');
});

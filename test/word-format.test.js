'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { WordFormatService, validatePlan } = require('../src/word-format');
const { buildFormatter, SOURCE_SHA256 } = require('../src/word-vba-adapter');
const { createHttpServer } = require('../src/http-server');
const { json } = require('../ui-modules/stream-client');
const { createStubLlm } = require('./stub-llm-server');
const root = path.join(__dirname, '..');
const docx = Buffer.from([80, 75, 3, 4, 1, 2, 3]);

function setup(t, options = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-word-'));
  const service = new WordFormatService({ dataDir, root, ...options });
  t.after(async () => { service.shutdown(); await service.tail; fs.rmSync(dataDir, { recursive: true, force: true }); });
  return service;
}
function formatter(request, { onProgress }) {
  onProgress('Formatting body ranges'); fs.writeFileSync(request.outputPath, docx);
  return Promise.resolve({ report: 'Finished.', macroFree: true, paragraphs: 2, tables: 1, revisions: request.changes.filter(x => x.replacement).length });
}

test('bundled VBA is unchanged, hash-checked, adapted without dialogs and has a bounded entry point', t => {
  const source = path.join(root, 'assets', 'word-format', 'ChineseDocumentFormatter_V35_1.bas');
  const bytes = fs.readFileSync(source);
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase(), SOURCE_SHA256);
  assert.match(fs.readFileSync(path.join(root, '.gitattributes'), 'utf8'), /assets\/word-format\/\*\.bas -text/);
  const code = buildFormatter(source);
  assert.match(code, /Public Function SpecFlow_Run/); assert.match(code, /SfProgress currentStep/);
  assert.doesNotMatch(code, /\bMsgBox\b|^Attribute /m);
  assert.match(code, /If Not SfSuccess Then Err.Raise/);
  const service = setup(t); const altered = path.join(service.directory, 'altered.bas'); fs.writeFileSync(altered, bytes.subarray(1));
  assert.throws(() => buildFormatter(altered), /校验值/);
});

test('Word uploads reject macros, fake extensions, oversize and traversal while preserving the original', async t => {
  const service = setup(t, { runner: formatter });
  assert.throws(() => service.upload('evil.docm', docx), /DOCM/);
  assert.throws(() => service.upload('fake.docx', Buffer.from('not word')), /不匹配/);
  assert.throws(() => service.upload('empty.docx', Buffer.alloc(0)), /为空/);
  assert.throws(() => service.upload('large.docx', Buffer.alloc(50 * 1024 * 1024 + 1)), /50 MB/);
  assert.throws(() => service.source('../../secret'), /ID/);
  const uploaded = service.upload('../工程.docx', docx); assert.equal(uploaded.name, '工程.docx');
  assert.throws(() => service.create({ fileId: uploaded.id }), /确认/);
  const created = service.create({ fileId: uploaded.id, confirmVba: true }); await service.tail;
  const job = service.get(created.id); assert.equal(job.state, 'completed');
  assert.deepEqual(fs.readFileSync(service.source(uploaded.id).path), docx);
  assert.match(service.artifact(job.id, 'output').name, /标准化\.docx$/);
  assert.equal(JSON.parse(fs.readFileSync(service.artifact(job.id, 'report').file)).sourceSha256, SOURCE_SHA256);
  assert.throws(() => service.artifact(job.id, '../../'), /产物类型/);
});

test('LLM suggestions accept only whitelisted roles and reject destructive fields, tables and duplicate indexes', () => {
  const paragraphs = [{ index: 1, text: '正文', editable: true }, { index: 2, text: '表格', inTable: true, editable: true }, { index: 3, text: '公式', editable: false }];
  const plan = validatePlan({ changes: [{ index: 1, role: 'heading1', replacement: '修订正文' }] }, paragraphs);
  assert.equal(plan[0].selected, false); assert.equal(plan[0].originalText, '正文');
  for (const changes of [[{ index: 5, role: 'body' }], [{ index: 1, role: 'run-code' }], [{ index: 2, role: 'heading1' }], [{ index: 3, role: 'body' }], [{ index: 1, role: 'body', replacement: '跨\n段' }], [{ index: 1, role: 'body' }, { index: 1, role: 'keep' }]]) assert.throws(() => validatePlan({ changes }, paragraphs));
});

test('LLM review streams a plan, requires review and separate tracked text consent, then formats a new copy', async t => {
  const stub = createStubLlm({ answer: JSON.stringify({ summary: '检查章节', changes: [{ index: 1, role: 'heading1', reason: '章节标题' }, { index: 2, role: 'body', replacement: '改正错别字', reason: '用户要求' }] }) });
  const port = await stub.listen(); t.after(() => stub.close());
  let accepted;
  const service = setup(t, { getLlm: () => ({ baseUrl: 'http://127.0.0.1:' + port, model: 'test' }), runner: async (request, context) => {
    if (request.action === 'inspect') return { paragraphCount: 2, truncated: false, paragraphs: [{ index: 1, text: '项目概况', editable: true }, { index: 2, text: '原文', editable: true }] };
    accepted = request.changes; return formatter(request, context);
  } });
  const file = service.upload('工程.docx', docx);
  assert.throws(() => service.create({ fileId: file.id, mode: 'vba-llm', confirmVba: true }), /确认/);
  const created = service.create({ fileId: file.id, mode: 'vba-llm', confirmVba: true, confirmLlm: true });
  const deltas = []; service.on(created.id, event => { if (event.type === 'delta') deltas.push(event.text); });
  await service.tail; const job = service.get(created.id); assert.equal(job.state, 'awaiting-review'); assert.ok(deltas.length);
  assert.throws(() => service.apply(job.id, { changes: [] }), /审核/);
  assert.throws(() => service.apply(job.id, { confirmApply: true, changes: [{ index: 99, role: 'body' }] }), /计划之外/);
  assert.throws(() => service.apply(job.id, { confirmApply: true, changes: [{ index: 2, role: 'body', applyText: true }] }), /单独确认/);
  service.apply(job.id, { confirmApply: true, confirmTextEdits: true, changes: [{ index: 1, role: 'heading1' }, { index: 2, role: 'body', applyText: true }] });
  await service.tail; assert.equal(job.state, 'completed'); assert.equal(job.revisions, 1); assert.equal(accepted[1].originalText, '原文');
  assert.equal(stub.state.lastBody.stream, true);
});

test('queued cancellations and restart recovery do not leave tasks running or expose outputs', async t => {
  let release;
  const service = setup(t, { runner: async (request, context) => { await new Promise(resolve => { release = resolve; }); return formatter(request, context); } });
  const file = service.upload('工程.docx', docx);
  const first = service.create({ fileId: file.id, confirmVba: true });
  const second = service.create({ fileId: file.id, confirmVba: true });
  await new Promise(resolve => setImmediate(resolve)); service.cancel(second.id); release(); await service.tail;
  assert.equal(service.get(second.id).state, 'cancelled'); assert.equal(service.controllers.size, 0);
  assert.throws(() => service.artifact(second.id, 'output'), /尚未完成/);
  service.update(service.get(first.id), { state: 'formatting' });
  const restarted = new WordFormatService({ dataDir: path.dirname(service.directory), root });
  assert.equal(restarted.get(first.id).state, 'error'); restarted.shutdown();
});

test('Word tool API serves independent UI, live events and downloadable results with consistent envelopes', async t => {
  const wordFormat = setup(t, { runner: formatter });
  const { server } = createHttpServer({ service: { wordFormat } });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const base = 'http://127.0.0.1:' + server.address().port;
  const page = await fetch(base + '/tools/word-format'); assert.equal(page.status, 200); assert.match(await page.text(), /confirmWordVba/);
  assert.equal((await fetch(base + '/tool-assets/word-format-window.js')).status, 200);
  let response = await fetch(base + '/api/v1/word-format/files', { method: 'POST', headers: { 'X-File-Name': encodeURIComponent('测试.docx') }, body: docx });
  assert.equal(response.status, 201); const file = (await response.json()).data;
  response = await fetch(base + '/api/v1/word-format/jobs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: file.id, confirmVba: true }) });
  assert.equal(response.status, 202); const job = (await response.json()).data; await wordFormat.tail;
  const abort = new AbortController(); const events = [];
  const feed = await fetch(base + '/api/v1/word-format/jobs/' + job.id + '/events', { signal: abort.signal });
  await json(feed, event => { events.push(event); abort.abort(); }).catch(error => assert.equal(error.name, 'AbortError'));
  assert.equal(events[0].job.state, 'completed');
  response = await fetch(base + '/api/v1/word-format/jobs/' + job.id + '/output');
  assert.equal(response.status, 200); assert.match(response.headers.get('content-disposition'), /attachment/);
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), docx);
  const invalid = await fetch(base + '/api/v1/word-format/jobs/bad'); assert.equal(invalid.status, 400); assert.equal((await invalid.json()).ok, false);
});

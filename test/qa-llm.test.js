'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStubLlm } = require('./stub-llm-server');
const { RagIndex } = require('../src/rag');
const { ask } = require('../src/qa');

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kb-platform-'));
const library = path.join(root, '资料库');
const docDir = path.join(library, '测试规范--abcd1234');
fs.mkdirSync(docDir, { recursive: true });
const fixture = {
  schemaVersion: '1.0',
  document: { id: 'doc_test', title: '测试规范', sourceName: 't.pdf', createdAt: new Date().toISOString(), pageCount: 2 },
  coordinateSystems: { normalized: { origin: 'top-left', unit: 'ratio', range: [0, 1] }, pdf: { origin: 'bottom-left', unit: 'point' } },
  pages: [
    { number: 1, width: 595, height: 842, items: ['p0001-i000000', 'p0001-i000001'] },
    { number: 2, width: 595, height: 842, items: [] }
  ],
  items: [
    { id: 'p0001-i000000', page: 1, order: 0, sourceIndex: 0, type: 'title', text: '消防车道与消防车登高操作场地', headingLevel: 2, bbox: { pdf: [50, 780, 300, 800], normalized: [0.08, 0.05, 0.5, 0.07] } },
    { id: 'p0001-i000001', page: 1, order: 1, sourceIndex: 1, type: 'text', text: '消防车道净宽度不应小于4.0m，净空高度不应小于4.0m，转弯半径不应小于9m。', bbox: { pdf: [50, 700, 420, 740], normalized: [0.08, 0.12, 0.7, 0.17] } },
    { id: 'p0001-i000002', page: 1, order: 2, sourceIndex: 2, type: 'table', html: '<table><tr><td>进站道路宽度</td><td>4.0m</td></tr></table>', bbox: { pdf: [50, 600, 420, 660], normalized: [0.08, 0.21, 0.7, 0.29] } }
  ]
};
fs.writeFileSync(path.join(docDir, 'document.json'), JSON.stringify(fixture), 'utf8');

test('BM25 检索：命中携带 页/条文号/坐标', () => {
  const rag = new RagIndex({ library });
  const hits = rag.search('消防车道净宽度', { topK: 5 });
  assert.ok(hits.length >= 1, '至少命中一条');
  assert.equal(hits[0].title, '测试规范');
  assert.equal(hits[0].page, 1);
  assert.ok(Array.isArray(hits[0].bbox) && hits[0].bbox.length === 4, '命中带 bbox');
});

test('未配置 LLM：降级为检索模式并返回引用', async () => {
  const settings = { library, llm: { baseUrl: '', apiKey: '', model: '', timeoutMs: 5000 } };
  const rag = new RagIndex(settings);
  const res = await ask({ question: '进站道路宽度要求', scenarioId: 'design' }, { rag, settings });
  assert.equal(res.mode, 'retrieval');
  assert.ok(res.citations.length >= 1, '返回引用');
  assert.ok(res.citations[0].docId === 'doc_test');
  assert.ok(res.note && res.note.includes('LLM'));
});

test('配置 LLM 后：生成式回答并保留可定位引用', async () => {
  const stub = createStubLlm();
  const port = await stub.listen();
  const settings = { library, llm: { baseUrl: 'http://127.0.0.1:' + port + '/v1', apiKey: '', model: 'stub-model', timeoutMs: 10000 } };
  const rag = new RagIndex(settings);
  const res = await ask({ question: '消防车道净宽度要求是多少？', scenarioId: 'design' }, { rag, settings });
  assert.equal(res.mode, 'llm');
  assert.match(res.answer, /STUB/);
  assert.ok(res.citations.length >= 1, '引用不为空');
  assert.ok(res.citations[0].page === 1 && Array.isArray(res.citations[0].bbox), '引用可定位');
  const sent = JSON.stringify(stub.state.lastBody || {});
  assert.match(sent, /片段 1/, '提示词中包含带编号的上下文片段');
  assert.match(sent, /chat\/completions|messages/, '走 OpenAI 兼容接口');
  await stub.close();
});

test('场景模板：设计/科研/通用', () => {
  const { SCENARIOS, getScenario } = require('../src/scenarios');
  assert.ok(SCENARIOS.length >= 3);
  assert.equal(getScenario('design').id, 'design');
  assert.match(getScenario('research').system, /综述/);
});
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createStubLlm } = require('./stub-llm-server');

const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-'));
process.env.KB_ROOT = rootDir;
process.env.KB_DATA_DIR = path.join(rootDir, 'data');
fs.mkdirSync(path.join(rootDir, 'data'), { recursive: true });

const dirName = '测试规范--abcd1234';
const docDir = path.join(rootDir, '资料库', dirName);
fs.mkdirSync(docDir, { recursive: true });
const fixture = {
  schemaVersion: '1.0',
  document: { id: 'doc_test', title: '测试规范', sourceName: 't.pdf', createdAt: new Date().toISOString(), pageCount: 2 },
  coordinateSystems: { pdf: { origin: 'bottom-left', unit: 'point' } },
  pages: [{ number: 1, width: 595, height: 842, items: ['p0001-i000000', 'p0001-i000001'] }],
  items: [
    { id: 'p0001-i000000', page: 1, order: 0, sourceIndex: 0, type: 'text', text: '12.2.7 消防车道净宽度不应小于4.0m，转弯半径不应小于9m。', bbox: { pdf: [110, 555, 318, 570], normalized: [0.18, 0.32, 0.54, 0.34] } },
    { id: 'p0001-i000001', page: 1, order: 1, sourceIndex: 1, type: 'table', html: '<table><tr><td>进站道路</td><td>4.0m</td></tr></table>', bbox: { pdf: [50, 400, 500, 470], normalized: null } }
  ]
};
fs.writeFileSync(path.join(docDir, 'document.json'), JSON.stringify(fixture), 'utf8');
fs.writeFileSync(path.join(rootDir, 'data', 'documents.json'), JSON.stringify([{
  id: 'doc_test', file: 't.pdf', title: '测试规范', ext: '.pdf', dirName, outputDir: docDir,
  status: 'ready', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), progress: 100
}]), 'utf8');

const { KnowledgeBaseService } = require('../src/service');
const { RagIndex, searchDetailed } = require('../src/rag');
const embeddings = require('../src/embeddings');

test('能力清单：暴露 schema 与联动接口', () => {
  const service = new KnowledgeBaseService();
  const caps = service.capabilities();
  assert.equal(caps.product, 'specflow-design-assistant');
  assert.ok(caps.endpoints.some(e => e.path === '/api/v1/export/items'), '含导出接口');
  assert.ok(caps.schemas.ask && caps.schemas.citation, '含 schema 契约');
  assert.ok(caps.features.includes('citation-jump-highlight'));
  assert.ok(caps.features.includes('general-llm-fallback'));
  assert.ok(caps.features.includes('inline-citation-links'));
});

test('结构化条目导出：卡片带条文号与定位坐标', () => {
  const service = new KnowledgeBaseService();
  const out = service.exportItems({ docId: 'doc_test' });
  assert.equal(out.kind, 'item-cards');
  assert.equal(out.cards.length, 2);
  const first = out.cards[0];
  assert.equal(first.ref, '12.2.7');
  assert.deepEqual(first.locate.bbox, [110, 555, 318, 570]);
  assert.deepEqual(first.locate.bboxNormalized, [0.18, 0.32, 0.54, 0.34]);
  assert.match(first.sourceUrl, /\/source#page=1$/);
});

test('混合检索：配置 embedding 后 BM25+向量 RRF 融合', async () => {
  const stub = createStubLlm();
  const port = await stub.listen();
  const settings = { library: path.join(rootDir, '资料库'), llm: { baseUrl: 'http://127.0.0.1:' + port + '/v1', model: 'stub-chat', embeddingModel: 'stub-embed', timeoutMs: 10000 } };
  const index = new RagIndex(settings);
  const detailed = await searchDetailed(index, '消防车道净宽度', { topK: 5 }, { settings, embeddings });
  assert.equal(detailed.retrieval.mode, 'hybrid');
  assert.ok(detailed.retrieval.vectors >= 2, '向量已写入并缓存');
  assert.ok(detailed.hits.length >= 1);
  assert.ok(detailed.hits[0].matched.includes('bm25') || detailed.hits[0].matched.includes('vector'));
  await stub.close();
});

test('配置 LLM 后问答：mode=llm 且写入会话历史', async () => {
  const stub = createStubLlm({ answer: '依据 [1]：净宽度不小于 4.0m。[1]' });
  const port = await stub.listen();
  const service = new KnowledgeBaseService();
  service.updateSettings({ llm: { baseUrl: 'http://127.0.0.1:' + port + '/v1', model: 'stub-chat', apiKey: '', embeddingModel: '' } });
  const result = await service.ask({ question: '消防车道净宽度要求是多少？', scenario: 'design' });
  assert.equal(result.mode, 'llm');
  assert.match(result.answer, /4\.0m/);
  assert.ok(result.citations.length >= 1);
  assert.ok(result.conversationId, '返回会话 id');
  const list = service.listConversations();
  assert.ok(list.length >= 1 && list[0].citations.length >= 1, '会话已记录引用');
  assert.ok(list[0].retrieval && list[0].retrieval.mode, '会话记录检索元信息');
  await stub.close();
});

test('界面配置写入前校验服务端口与解析后端', () => {
  const service = new KnowledgeBaseService();
  assert.throws(() => service.updateSettings({ port: 80 }), /1024/);
  assert.throws(() => service.updateSettings({ parser: { backend: 'unknown-backend' } }), /不支持/);
});

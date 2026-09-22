'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createHttpServer } = require('../src/http-server');

function fakeService() {
  return {
    settings: { library: 'test', mineru: 'mineru' },
    queue: { snapshot: () => ({ concurrency: 1, pending: [], active: [] }) },
    health: () => ({ service: 'knowledge-base-tool', status: 'ok' }),
    list: () => []
  };
}

test('serves versioned success and error envelopes', async t => {
  const { server } = createHttpServer({ service: fakeService() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const base = `http://127.0.0.1:${address.port}`;

  const healthResponse = await fetch(base + '/api/v1/health');
  const health = await healthResponse.json();
  assert.equal(healthResponse.status, 200);
  assert.equal(health.ok, true);
  assert.equal(health.apiVersion, 'v1');
  assert.equal(health.data.service, 'knowledge-base-tool');

  const errorResponse = await fetch(base + '/api/v1/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}'
  });
  const error = await errorResponse.json();
  assert.equal(errorResponse.status, 400);
  assert.equal(error.ok, false);
  assert.equal(error.error.code, 'MISSING_SOURCE_PATH');
});

test('does not grant CORS access to an arbitrary website by default', async t => {
  const { server } = createHttpServer({ service: fakeService() });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`, {
    headers: { Origin: 'https://untrusted.example' }
  });
  assert.equal(response.headers.has('access-control-allow-origin'), false);
});

test('exposes document group management through the versioned API', async t => {
  const groups = [];
  const service = Object.assign(fakeService(), {
    listGroups: () => groups,
    createGroup: name => { const group = { id: 'grp_test', name, documentCount: 0 }; groups.push(group); return group; },
    updateGroup: (id, body) => Object.assign(groups.find(group => group.id === id), body),
    deleteGroup: id => ({ id, ungroupedDocuments: 0 }),
    assignDocumentGroup: (id, groupId) => ({ id, groupId })
  });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const createdResponse = await fetch(base + '/api/v1/groups', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '消防设计' }) });
  const created = await createdResponse.json();
  assert.equal(createdResponse.status, 201);
  assert.equal(created.data.id, 'grp_test');
  const listed = await fetch(base + '/api/v1/groups').then(response => response.json());
  assert.equal(listed.data.items[0].name, '消防设计');
  const assigned = await fetch(base + '/api/v1/documents/doc_test', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groupId: 'grp_test' }) }).then(response => response.json());
  assert.equal(assigned.data.document.groupId, 'grp_test');
});

test('limits external search to the requested document group', async t => {
  let searchOptions;
  const service = Object.assign(fakeService(), {
    resolveDocumentIds: payload => payload.groupId === 'grp_fire' ? ['doc_fire_1', 'doc_fire_2'] : [],
    search: (_query, options) => { searchOptions = options; return [{ docId: 'doc_fire_1', page: 5, text: '消防车道' }]; }
  });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/search?q=${encodeURIComponent('消防车道')}&group=grp_fire&topK=6`);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.data.groupId, 'grp_fire');
  assert.deepEqual(searchOptions, { topK: 6, docIds: ['doc_fire_1', 'doc_fire_2'] });
  assert.equal(body.data.hits[0].docId, 'doc_fire_1');
});

test('hands a Harness citation link to the running SpecFlow desktop listener', async t => {
  const service = Object.assign(fakeService(), { get: id => id === 'doc_test' ? { id, title: '测试规范' } : null });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const opened = new Promise(resolve => server.once('specflow:open-citation', resolve));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/open/citation?doc=doc_test&page=9&item=p9-i2&ref=5.2.7&bbox=1,2,3,4&nbbox=.1,.2,.3,.4`);
  const payload = await opened;
  assert.equal(response.status, 200);
  assert.match(await response.text(), /已发送到 SpecFlow/);
  assert.deepEqual(payload, { docId: 'doc_test', page: 9, itemId: 'p9-i2', ref: '5.2.7', bbox: [1, 2, 3, 4], bboxNormalized: [0.1, 0.2, 0.3, 0.4] });
});

test('serves PDF bytes with cache disabled so reparsed content cannot stay stale', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-pdf-cache-'));
  const source = path.join(root, 'source.pdf');
  fs.writeFileSync(source, Buffer.from('%PDF-test'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const service = Object.assign(fakeService(), { get: () => ({ id: 'doc_test' }), paths: () => ({ source }) });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/pdf?id=doc_test`);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(Buffer.from(await response.arrayBuffer()).toString(), '%PDF-test');
});

test('exposes project templates, project creation and checklist updates', async t => {
  const detail = {
    id: 'prj_test', name: '试验工程', projectDirectory: 'C:\\Projects\\试验工程', folders: ['00工作区间'],
    checklist: [{ id: 'check_flood-level', status: 'missing' }],
    checklistProgress: { ready: 0, applicable: 1, total: 1, percent: 0 }
  };
  const service = Object.assign(fakeService(), {
    workspaceSnapshot: () => ({ settings: { defaultFolders: ['00工作区间'] }, projects: [] }),
    updateWorkspaceSettings: body => ({ defaultFolders: body.defaultFolders }),
    createEngineeringProject: body => ({ ...detail, name: body.name }),
    engineeringProject: () => detail,
    syncEngineeringProjectFolders: () => detail,
    updateEngineeringChecklist: (_projectId, _itemId, patch) => ({ ...detail, checklist: [{ id: 'check_flood-level', status: patch.status }] }),
    addEngineeringChecklistItem: (_projectId, body) => ({ ...detail, checklist: detail.checklist.concat({ id: 'check_custom', label: body.label, status: 'missing' }) })
  });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;

  const snapshot = await fetch(base + '/api/v1/workspace').then(response => response.json());
  assert.deepEqual(snapshot.data.settings.defaultFolders, ['00工作区间']);
  const createdResponse = await fetch(base + '/api/v1/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '变电站项目', baseDirectory: 'C:\\Projects' }) });
  assert.equal(createdResponse.status, 201);
  assert.equal((await createdResponse.json()).data.name, '变电站项目');
  const checked = await fetch(base + '/api/v1/projects/prj_test/checklist/check_flood-level', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'ready' }) }).then(response => response.json());
  assert.equal(checked.data.checklist[0].status, 'ready');
});

test('exposes scheduled specification website monitoring', async t => {
  const item = { id: 'mon_test', name: '规范公告', url: 'https://example.com/standards', status: 'baseline' };
  const service = Object.assign(fakeService(), {
    listSpecificationMonitors: () => ({ items: [item], running: [] }),
    createSpecificationMonitor: async body => ({ ...item, name: body.name }),
    updateSpecificationMonitor: (_id, body) => ({ ...item, enabled: body.enabled }),
    deleteSpecificationMonitor: id => ({ id, removed: true }),
    checkSpecificationMonitor: async () => ({ ...item, status: 'unchanged' }),
    checkAllSpecificationMonitors: async () => ({ items: [{ ...item, status: 'unchanged' }] })
  });
  const { server } = createHttpServer({ service });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const listed = await fetch(base + '/api/v1/spec-monitors').then(response => response.json());
  assert.equal(listed.data.items[0].id, 'mon_test');
  const checked = await fetch(base + '/api/v1/spec-monitors/mon_test/check', { method: 'POST' }).then(response => response.json());
  assert.equal(checked.data.status, 'unchanged');
  const created = await fetch(base + '/api/v1/spec-monitors', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '住建部公告', url: 'https://example.com/notices' }) }).then(response => response.json());
  assert.equal(created.data.name, '住建部公告');
});

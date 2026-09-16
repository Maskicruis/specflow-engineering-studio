'use strict';

const assert = require('node:assert/strict');
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

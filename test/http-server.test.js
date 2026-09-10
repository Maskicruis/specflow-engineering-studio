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

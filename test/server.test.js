'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { parseArgs } = require('../server');

test('executable accepts scheduler-friendly host and port overrides', () => {
  assert.deepEqual(parseArgs(['--no-open', '--port', '8890', '--host=127.0.0.1']), {
    open: false,
    port: 8890,
    host: '127.0.0.1'
  });
  assert.throws(() => parseArgs(['--port=70000']), /1–65535/);
});

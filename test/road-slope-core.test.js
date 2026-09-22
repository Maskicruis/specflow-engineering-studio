'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateNetwork } = require('../ui-modules/road-slope-core');

test('calculates elevations from user-entered network distances instead of canvas coordinates', () => {
  const result = calculateNetwork({
    decimals: 3,
    nodes: [
      { key: 'n1', x: 0, y: 0, fixed: true, elevation: 100 },
      { key: 'n2', x: 900, y: 500, fixed: false, elevation: null },
      { key: 'n3', x: 20, y: 20, fixed: false, elevation: null }
    ],
    edges: [
      { id: 'e1', from: 'n1', to: 'n2', distance: 30, slope: 5, minSlope: 3 },
      { id: 'e2', from: 'n2', to: 'n3', distance: 12.5, slope: 8, minSlope: 5 }
    ]
  });
  assert.equal(result.elevations.n2, 99.85);
  assert.equal(result.elevations.n3, 99.75);
  assert.equal(result.edgeResults[0].distance, 30);
  assert.equal(result.ok, true);
});

test('reports fixed-elevation conflicts and specification slope violations', () => {
  const result = calculateNetwork({
    decimals: 3,
    nodes: [{ key: 'a', fixed: true, elevation: 100 }, { key: 'b', fixed: true, elevation: 99.95 }],
    edges: [{ id: 'ab', from: 'a', to: 'b', distance: 20, slope: 5, minSlope: 4, maxSlope: 8 }]
  });
  assert.ok(Math.abs(result.edgeResults[0].actualSlope - 2.5) < 1e-9);
  assert.ok(result.issues.some(issue => /网络冲突/.test(issue.message)));
  assert.ok(result.issues.some(issue => /小于规范最小值/.test(issue.message)));
});

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { calculateNetwork, normalizeSegments, segmentNodeKeys } = require('../ui-modules/road-slope-core');

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

test('splits every flow path at intermediate nodes and keeps one arrow per adjacent pair', () => {
  const nodes = [
    { key: 'p1', x: 100, y: 100 },
    { key: 'p2', x: 250, y: 100 },
    { key: 'p3', x: 400, y: 100 },
    { key: 'p4', x: 550, y: 100 }
  ];
  assert.deepEqual(segmentNodeKeys('p1', 'p4', nodes), ['p1', 'p2', 'p3', 'p4']);
  const normalized = normalizeSegments({
    nodes,
    edges: [
      { id: 'direct', from: 'p2', to: 'p1', distance: 20, slope: 5 },
      { id: 'left', from: 'p3', to: 'p1', distance: 40, slope: 5 },
      { id: 'right', from: 'p1', to: 'p4', distance: 60, slope: 5 }
    ]
  });
  assert.deepEqual(normalized.edges.map(edge => [edge.from, edge.to]), [
    ['p2', 'p1'], ['p3', 'p2'], ['p3', 'p4']
  ]);
  assert.equal(normalized.edges[0].distance, 20);
  assert.equal(normalized.edges[1].distance, '');
  assert.equal(normalized.edges[2].distance, '');
  assert.equal(normalized.splitEdges, 2);
});

test('supports a middle high point draining independently to both sides', () => {
  const result = calculateNetwork({
    decimals: 3,
    nodes: [
      { key: 'left', fixed: false, elevation: null },
      { key: 'high', fixed: true, elevation: 100 },
      { key: 'right', fixed: false, elevation: null }
    ],
    edges: [
      { id: 'to-left', from: 'high', to: 'left', distance: 20, slope: 5, minSlope: 3 },
      { id: 'to-right', from: 'high', to: 'right', distance: 30, slope: 5, minSlope: 3 }
    ]
  });
  assert.equal(result.elevations.left, 99.9);
  assert.equal(result.elevations.right, 99.85);
  assert.equal(result.ok, true);
});

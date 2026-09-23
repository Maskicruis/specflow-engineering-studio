'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DesignToolRegistry } = require('../desktop/design-tools.cjs');

test('design tool registry persists and launches only the configured executable', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-tools-'));
  try {
    const executable = path.join(temporary, 'calculator.exe');
    fs.writeFileSync(executable, 'stub');
    let launched = '';
    const registry = new DesignToolRegistry({ dataDir: temporary, calculatorPath: executable, spawnImpl: file => { launched = file; return { unref() {} }; } });
    assert.equal(registry.list().items.find(item => item.id === 'calculator').available, true);
    assert.equal(registry.list().items.find(item => item.id === 'road-slope').hotkey, 'Ctrl+Alt+R');
    assert.equal(registry.list().items.find(item => item.id === 'road-slope').launchMode, 'window');
    assert.equal(registry.list().items.find(item => item.id === 'calculator').discipline, '通用计算');
    registry.launch('calculator');
    assert.equal(launched, executable);
    assert.throws(() => registry.update('calculator', { path: path.join(temporary, 'bad.txt') }), /exe、cmd 或 bat/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

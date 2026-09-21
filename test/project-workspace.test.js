'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { DEFAULT_FOLDERS, ProjectWorkspace, normalizeFolders } = require('../src/project-workspace');

test('creates a project tree and seeds a staged completeness checklist', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-projects-'));
  try {
    const dataDir = path.join(temporary, 'data');
    const baseDirectory = path.join(temporary, 'projects');
    const workspace = new ProjectWorkspace({ dataDir });
    const project = workspace.createProject({ name: '测试变电站', baseDirectory });
    assert.equal(project.folders.length, DEFAULT_FOLDERS.length);
    for (const folder of DEFAULT_FOLDERS) assert.equal(fs.existsSync(path.join(project.projectDirectory, folder)), true);
    assert.ok(project.checklist.some(item => item.id === 'check_flood-level'));
    assert.ok(project.checklist.some(item => item.id === 'check_technical-economy'));
    assert.equal(project.checklistProgress.percent, 0);
    const updated = workspace.updateChecklist(project.id, 'check_flood-level', { status: 'ready', note: '百年一遇洪水位已收集' });
    assert.equal(updated.checklist.find(item => item.id === 'check_flood-level').status, 'ready');
    assert.ok(updated.checklistProgress.percent > 0);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

test('folder templates are configurable and reject traversal', () => {
  assert.deepEqual(normalizeFolders(['00工作区间', '06计算书', '06计算书']), ['00工作区间', '06计算书']);
  assert.throws(() => normalizeFolders(['..']), /无效字符/);
  assert.throws(() => normalizeFolders(['a\\b']), /无效字符/);
});

test('requires an explicit base directory instead of using the process directory', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-project-path-'));
  try {
    const workspace = new ProjectWorkspace({ dataDir: path.join(temporary, 'data') });
    assert.throws(() => workspace.createProject({ name: '缺少路径' }), /请选择项目保存目录/);
  } finally { fs.rmSync(temporary, { recursive: true, force: true }); }
});

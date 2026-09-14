'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { ensureKnowledgeSkill, firstExisting } = require('../desktop/harness-runtime.cjs');

test('installs a managed DSH skill that connects Harness to the local knowledge API', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-dsh-'));
  try {
    const result = ensureKnowledgeSkill({ dshHome: home, baseUrl: 'http://127.0.0.1:8790' });
    const content = fs.readFileSync(result.path, 'utf8');
    assert.equal(result.installed, true);
    assert.match(content, /managed-by-specflow-engineering-studio/);
    assert.match(content, /\/api\/v1\/ask/);
    assert.match(content, /\/api\/v1\/groups/);
    assert.match(content, /conversationId/);
    assert.match(content, /sourceUrl/);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

test('preserves a user-owned DSH skill at the same path', () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'specflow-dsh-user-'));
  const skill = path.join(home, 'skills', 'specflow-knowledge-base', 'SKILL.md');
  try {
    fs.mkdirSync(path.dirname(skill), { recursive: true });
    fs.writeFileSync(skill, 'user-owned skill', 'utf8');
    const result = ensureKnowledgeSkill({ dshHome: home, baseUrl: 'http://127.0.0.1:8790' });
    assert.equal(result.preserved, true);
    assert.equal(fs.readFileSync(skill, 'utf8'), 'user-owned skill');
    assert.equal(firstExisting(['', skill]), skill);
  } finally { fs.rmSync(home, { recursive: true, force: true }); }
});

'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ui = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');

test('界面包含问答与引用跳转高亮的接线', () => {
  assert.match(ui, /data-act="ask"/, '有提问按钮');
  assert.match(ui, /data-act="cite"/, '引用卡片可点击');
  assert.match(ui, /function openCitation/, '有 openCitation 处理');
  assert.match(ui, /VIEWER\.load\(docId\)/, '打开被引文档');
  assert.match(ui, /VIEWER\.goto\(Number\(page\), ref\|\|'', bbox\|\|''\)/, '跳页并传 bbox 高亮');
  assert.match(ui, /llmBase/, '有 LLM 配置输入');
  assert.match(ui, /id="qScenario"/, '有场景选择');
});

test('界面脚本语法有效（两个 script 块）', () => {
  const blocks = [...ui.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(blocks.length >= 2, '至少两个脚本块');
  for (const block of blocks) { assert.ok(block.trim().length > 0, '脚本块非空'); }
});
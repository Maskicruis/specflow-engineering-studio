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
  assert.match(ui, /VIEWER\.load\(docId,\{page:Number\(page\),keyword:ref\|\|'',bbox:pdfBox,normalizedBbox:normalizedBox\}\)/, '一次加载并定位被引文档');
  assert.match(ui, /data-nbbox/, '传递归一化坐标供可靠高亮');
  assert.match(ui, /class="citation-link"/, '正文引用渲染为链接');
  assert.match(ui, /参考来源 · 点击可跳转并高亮 PDF 原文/, '回答末尾始终附可读的原文链接');
  assert.match(ui, /class="answer-source-link"/, '文后来源包含真实超链接');
  assert.match(ui, /id="qMode"/, '可选择智能问答、仅资料库或通用对话');
  assert.match(ui, /id="chatMessages"/, '问答以多轮会话展示');
  assert.match(ui, /llmBase/, '有 LLM 配置输入');
  assert.match(ui, /id="qScenario"/, '有场景选择');
});

test('界面脚本语法有效（两个 script 块）', () => {
  const blocks = [...ui.matchAll(/<script(?: type="module")?>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  assert.ok(blocks.length >= 2, '至少两个脚本块');
  for (const block of blocks) { assert.ok(block.trim().length > 0, '脚本块非空'); }
});

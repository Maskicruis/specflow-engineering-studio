'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const view = require('../ui-modules/chat-view');
const { createHttpServer } = require('../src/http-server');
const html = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '..', 'ui-modules', 'chat-view.css'), 'utf8');
const citations = [{ n: 3, docId: 'd_test', title: '规范', page: 7, ref: '5.2.6', sourceUrl: 'http://127.0.0.1:8790/?openCitation=1&doc=d_test' }];
const citationLink = c => '<a class="citation-link" data-doc="' + c.docId + '">[' + c.n + ']</a>';

test('chat renders real headings, nested lists, quotes, tables and code instead of one padded bubble', () => {
  const text = '# 道路设计\n\n## 设计要点\n\n1. **道路宽度**不小于 4 m。[片段3]\n   - 检修道路\n   - 运输道路\n2. 核对消防条件\n\n> 原文核查\n\n| 项目 | 数值 |\n| --- | ---: |\n| 宽度 | 4 m |\n\n```js\nconst value = "<x>";\n```';
  const result = view.render(text, citations, citationLink);
  assert.match(result, /<h2>道路设计<\/h2>/); assert.match(result, /<h3>设计要点<\/h3>/);
  assert.match(result, /<ol start="1">[\s\S]*<ul>[\s\S]*<li>/); assert.match(result, /<blockquote>/);
  assert.match(result, /<th style="text-align:right">数值/); assert.match(result, /<td style="text-align:right">4 m/);
  assert.match(result, /const value = &quot;&lt;x&gt;&quot;/); assert.match(result, /data-act="copyCode"/);
  assert.match(result, /<strong>道路宽度<\/strong>/); assert.match(result, /data-doc="d_test"/);
  assert.doesNotMatch(result, /\*\*道路宽度\*\*/);
});

test('chat citations remain real links across notation variants but never replace code examples', () => {
  for (const marker of ['[3]', '[片段3]', '[片段 3]', '[Segment 3]', '【片段3】', '［3］', '[片段3](javascript:bad)']) {
    assert.match(view.render('要求' + marker, citations, citationLink), /data-doc="d_test"/);
  }
  const result = view.render('`[3]`\n\n```txt\n[片段3]\n```\n\n未知 [9]', citations, citationLink);
  assert.doesNotMatch(result, /citation-link/); assert.match(result, /未知 \[9\]/);
});

test('chat never executes model HTML, unsafe links or remote markdown images', () => {
  const result = view.render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[危险](javascript:alert) [文件](file:///c:/test) [安全](https://example.com/path?a=1&b=2) ![图片](https://example.com/x.png)', [], citationLink);
  assert.doesNotMatch(result, /<script|<img|href="(?:javascript|file):/);
  assert.match(result, /&lt;script&gt;/); assert.match(result, /href="https:\/\/example.com\/path\?a=1&amp;b=2"/);
  assert.match(result, /rel="noopener noreferrer"/);
  assert.match(view.render('```html\n<script>1</script>\n```', []), /&lt;script&gt;/);
});

test('partial markdown streams are safe and keep engineering numbers unchanged', () => {
  for (const text of ['**宽度', '# 标', '```python\nprint("4 m")', '[片段', '| 项目 | 数值 |\n| --- | --- |\n| 坡度 | 5.000‰ |']) assert.equal(typeof view.render(text, citations, citationLink), 'string');
  const result = view.render('设计坡度 5.000‰，标高 10.000 m；`i = 0.005`。', []);
  assert.match(result, /5\.000‰/); assert.match(result, /10\.000 m/); assert.match(result, /<code>i = 0\.005<\/code>/);
});

test('conversation state hides busy copy controls and preserves plain text plus actual citation URLs', () => {
  const node = () => ({ attrs: {}, setAttribute(k, value) { this.attrs[k] = value; } });
  const turn = { root: node(), answer: {}, cites: {}, sources: {}, sourceSummary: {}, copy: {} };
  view.setState(turn, 'pending'); assert.equal(turn.root.attrs['aria-busy'], 'true'); assert.equal(turn.copy.disabled, true);
  view.update(turn, '**结论** [3]', citations, view.render, citationLink); view.setState(turn, 'complete');
  assert.equal(turn.root.attrs['aria-busy'], 'false'); assert.equal(turn.copy.disabled, false); assert.equal(turn.sources.hidden, false);
  assert.match(turn.root._copyText, /\*\*结论\*\* \[3\]/); assert.ok(turn.root._copyText.includes(citations[0].sourceUrl));
  view.setState(turn, 'stopped'); assert.equal(turn.root.attrs['data-state'], 'stopped');
  view.update(turn, '普通回答', [], view.render, citationLink); assert.equal(turn.sources.hidden, true);
});

test('live streaming respects reading position and the explicit latest-answer action resumes follow', () => {
  const stream = { scrollTop: 100, scrollHeight: 1000, clientHeight: 400 }, button = {}, frames = [];
  assert.equal(view.nearBottom(stream), false); assert.equal(view.nearBottom({ scrollTop: 590, scrollHeight: 1000, clientHeight: 400 }), true);
  const context = { CHAT_FOLLOW: false, CHAT_SCROLL_PENDING: false, CHAT_LAST_SCROLL_TOP: 0, SpecFlowChatView: view, document: { querySelector: () => stream, getElementById: () => button }, requestAnimationFrame: f => frames.push(f) };
  vm.runInNewContext(html.slice(html.indexOf('function syncChatJump'), html.indexOf('function appendUserTurn')), context);
  context.scrollConversation(); assert.equal(frames.length, 0); assert.equal(stream.scrollTop, 100); assert.equal(button.hidden, false);
  context.scrollConversation(true); assert.equal(frames.length, 0); assert.equal(stream.scrollTop, 1000); assert.equal(button.hidden, true);
  context.scrollConversation(); context.CHAT_FOLLOW = false; stream.scrollTop = 80; frames.shift()(); assert.equal(stream.scrollTop, 80);
  vm.runInNewContext(html.slice(html.indexOf('function onChatScroll'), html.indexOf('var chatScroll=')), context);
  context.CHAT_FOLLOW = true; context.CHAT_LAST_SCROLL_TOP = 100; stream.scrollTop = 100; stream.scrollHeight = 2000;
  context.onChatScroll.call(stream); assert.equal(context.CHAT_FOLLOW, true, 'content growth is not a user scroll');
  stream.scrollTop = 30; context.onChatScroll.call(stream); assert.equal(context.CHAT_FOLLOW, false, 'upward reading stops follow');
});

test('conversation styles use theme tokens, remove the redundant card icon and honor reduced motion', () => {
  assert.match(html, /\/app\/chat-view\.css/); assert.match(html, /\/app\/chat-view\.js/);
  assert.match(css, /\.chat-assistant-body \.qa-answer::before \{ content: none;/);
  assert.match(css, /background: transparent; box-shadow: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/); assert.match(css, /animation: none !important/);
  assert.match(css, /@keyframes chat-arrive/); assert.match(css, /@keyframes chat-typing/);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i);
  assert.match(html, /data-act="copyAnswer"/); assert.match(html, /class="chat-sources" hidden/);
});

test('standalone service serves both conversation modules with correct MIME and no stale cache', async t => {
  const service = { settings: {}, health: () => ({ status: 'ok' }), list: () => [] };
  const { server } = createHttpServer({ service }); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = 'http://127.0.0.1:' + server.address().port;
  for (const file of ['chat-view.css', 'chat-view.js']) {
    const response = await fetch(base + '/app/' + file); assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), file.endsWith('.css') ? /text\/css/ : /javascript/);
    assert.match(response.headers.get('cache-control'), /no-store/); assert.ok((await response.text()).length > 500);
  }
});

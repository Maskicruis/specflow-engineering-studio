'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const stream = require('../ui-modules/stream-client');
const chatView = require('../ui-modules/chat-view');
const html = fs.readFileSync(path.join(__dirname, '..', 'ui.html'), 'utf8');
const code = html.slice(html.indexOf('async function askQuestion()'), html.indexOf('function toggleTheme()'));

function fixture(fetch) {
  const node = (value = '') => ({ value, innerHTML: '', textContent: '', style: {}, attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, focus() {} });
  const nodes = { q: node('问题'), qScenario: node('design'), qMode: node('general'), qScope: node('all'), sendQuestionButton: node(), qState: node(), assistantEmpty: node() };
  const turn = { root: node(), answer: node(), note: node(), cites: node(), reasoning: node(), reasoningText: node(), copy: node(), sources: node(), sourceSummary: node() };
  const renderWaiters = [];
  let restored = false;
  const context = { QA_BUSY: false, QA_CONTROLLER: null, CURRENT_CONVERSATION_ID: '', CHAT_HISTORY: [], AbortController, fetch, SpecFlowStream: stream, SpecFlowChatView: chatView,
    SpecFlowChatImages: { ready: () => true, count: () => 0, take: () => [], setBusy() {}, restore() { restored = true; } },
    document: { getElementById: id => nodes[id] }, appendUserTurn: () => ({ remove() {} }), appendAssistantTurn: () => turn,
    answerHtml: (text, citations) => text.replace(/\[1\]/g, citations.length ? '<a href="/citation">[1]</a>' : '[1]'), citationCard: () => '<a>citation</a>',
    requestAnimationFrame: callback => setImmediate(() => { callback(); for (const resolve of renderWaiters.splice(0)) resolve(); }), scrollConversation() {}, loadConversations() {}, scopePayload: () => ({}) };
  vm.createContext(context); vm.runInContext(code, context);
  return { context, nodes, turn, nextRender: () => new Promise(resolve => renderWaiters.push(resolve)), get restored() { return restored; } };
}
function frame(controller, value) { controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify(value) + '\n\n')); }

test('the real frontend handler renders partial text and inline links before stream completion', { timeout: 5000 }, async () => {
  let controller; const body = new ReadableStream({ start(value) { controller = value; } });
  const f = fixture(async () => new Response(body)); const pending = f.context.askQuestion();
  const rendered = f.nextRender();
  frame(controller, { type: 'citations', citations: [{ n: 1 }] }); frame(controller, { type: 'reasoning', text: '分析' }); frame(controller, { type: 'delta', text: '第一段[1]' });
  await rendered;
  assert.match(f.turn.answer.innerHTML, /第一段<a/); assert.equal(f.turn.reasoningText.textContent, '分析');
  assert.equal(f.context.QA_BUSY, true); assert.equal(f.nodes.sendQuestionButton.attrs['data-act'], 'stopAnswer');
  assert.equal(f.turn.root.attrs['data-state'], 'streaming'); assert.equal(f.turn.copy.disabled, true);
  frame(controller, { type: 'delta', text: '第二段' }); frame(controller, { type: 'done', mode: 'llm', grounding: 'general' }); frame(controller, { type: 'saved', conversationId: 'c_test' }); controller.close();
  await pending; assert.match(f.turn.answer.innerHTML, /第二段/); assert.equal(f.context.CURRENT_CONVERSATION_ID, 'c_test');
  assert.equal(f.context.CHAT_HISTORY.length, 2); assert.equal(f.nodes.q.readOnly, false); assert.equal(f.nodes.sendQuestionButton.attrs['data-act'], 'ask');
  assert.equal(f.turn.root.attrs['data-state'], 'complete'); assert.equal(f.turn.root.attrs['aria-busy'], 'false'); assert.equal(f.turn.copy.disabled, false);
  assert.match(f.turn.root._copyText, /第一段\[1\]第二段/); assert.equal(f.turn.sources.hidden, false);
});

test('the frontend restores input on a truncated stream without adding complete history', async () => {
  const f = fixture(async () => new Response('data: {"type":"delta","text":"部分回答"}\n\n'));
  await f.context.askQuestion(); assert.match(f.turn.note.textContent, /未保存/); assert.equal(f.nodes.q.value, '问题'); assert.equal(f.restored, true);
  assert.equal(f.context.CHAT_HISTORY.length, 0); assert.equal(f.context.QA_BUSY, false);
  assert.equal(f.turn.root.attrs['data-state'], 'error'); assert.equal(f.turn.root.attrs['aria-busy'], 'false');
});

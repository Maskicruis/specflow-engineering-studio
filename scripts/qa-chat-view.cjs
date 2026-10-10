'use strict';
// Run with Electron. All model requests and data are isolated QA fixtures.
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.build', 'chat-view-qa');
const data = path.join(output, 'data');
fs.mkdirSync(data, { recursive: true });
process.env.KB_DATA_DIR = data;
app.setPath('userData', path.join(data, 'electron'));
app.disableHardwareAcceleration();
let backend, stub, win;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression) {
  const deadline = Date.now() + 12000;
  while (Date.now() < deadline) { if (await win.webContents.executeJavaScript(expression)) return; await pause(50); }
  console.error(await win.webContents.executeJavaScript(`JSON.stringify({follow:CHAT_FOLLOW,scrollPending:CHAT_SCROLL_PENDING,busy:QA_BUSY,scrollTop:document.querySelector('.assistant-stream').scrollTop,scrollHeight:document.querySelector('.assistant-stream').scrollHeight,clientHeight:document.querySelector('.assistant-stream').clientHeight,jumpHidden:document.getElementById('chatJumpLatest').hidden})`));
  throw new Error('UI condition timed out: ' + expression);
}
async function capture(name) {
  await pause(500);
  const screenshot = await win.webContents.debugger.sendCommand('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  fs.writeFileSync(path.join(output, name + '.png'), Buffer.from(screenshot.data, 'base64'));
}
app.whenReady().then(async () => {
  try {
    const longAnswer = '# 工程资料审查\n\n' + Array.from({ length: 20 }, (_, i) => '## ' + (i + 1) + '. 核对项目条件\n\n这是用于验证长回答流式排版与阅读位置的测试内容。设计坡度为 5.000‰，标高为 10.000 m；软件不应更改数值，也不应把正在阅读的用户拉回底部。').join('\n\n');
    stub = http.createServer((request, response) => {
      request.resume(); request.on('end', () => {
        response.writeHead(200, { 'Content-Type': 'text/event-stream' });
        response.write('data: ' + JSON.stringify({ choices: [{ delta: { reasoning_content: '正在核对资料范围；这是本机测试，不访问真实模型。' } }] }) + '\n\n');
        let offset = 0;
        const timer = setInterval(() => {
          if (response.destroyed) return clearInterval(timer);
          response.write('data: ' + JSON.stringify({ choices: [{ delta: { content: longAnswer.slice(offset, offset + 32) } }] }) + '\n\n');
          offset += 32;
          if (offset >= longAnswer.length) { clearInterval(timer); response.end('data: [DONE]\n\n'); }
        }, 90);
        response.on('close', () => clearInterval(timer));
      });
    });
    await new Promise(resolve => stub.listen(0, '127.0.0.1', resolve));
    backend = require('../src/http-server').createHttpServer();
    backend.service.updateSettings({ llm: { baseUrl: 'http://127.0.0.1:' + stub.address().port, model: 'local-chat-qa' }, library: path.join(data, 'library') });
    await new Promise(resolve => backend.server.listen(0, '127.0.0.1', resolve));
    win = new BrowserWindow({ width: 1460, height: 920, frame: false, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    const errors = [];
    win.webContents.on('console-message', event => { if (event.level === 'error') errors.push(event.message); });
    await win.loadURL('http://127.0.0.1:' + backend.server.address().port + '/?desktop=1');
    win.webContents.debugger.attach('1.3');
    await waitFor('!!document.querySelector("#qScenario option") && !!window.SpecFlowChatImages');
    const pending = await win.webContents.executeJavaScript(`(() => { document.body.classList.add('desktop-app'); document.documentElement.setAttribute('data-theme','dark'); newChat(); document.getElementById('qMode').value='general'; document.getElementById('q').value='请核对工程资料（本机界面测试）'; window.__qaPromise=askQuestion(); return document.querySelector('.chat-turn.assistant').getAttribute('data-state'); })()`);
    assert.equal(pending, 'pending');
    await waitFor(`document.querySelector('.chat-turn.assistant').getAttribute('data-state')==='streaming' && document.querySelector('.qa-answer').textContent.length>20`);
    assert.notEqual(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.chat-state-dot')).animationName`), 'none');
    await waitFor(`QA_BUSY && document.querySelector('.assistant-stream').scrollHeight > document.querySelector('.assistant-stream').clientHeight + 250`);
    const before = await win.webContents.executeJavaScript(`(() => { const s=document.querySelector('.assistant-stream');s.scrollTop=0;s.dispatchEvent(new Event('scroll'));return document.querySelector('.qa-answer').textContent.length; })()`);
    await waitFor(`document.querySelector('.qa-answer').textContent.length>${before + 50}`);
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.assistant-stream').scrollTop`), 0);
    assert.equal(await win.webContents.executeJavaScript(`document.getElementById('chatJumpLatest').hidden`), false);
    await win.webContents.executeJavaScript(`document.getElementById('chatJumpLatest').click()`);
    await waitFor(`CHAT_FOLLOW && SpecFlowChatView.nearBottom(document.querySelector('.assistant-stream'))`);
    await capture('streaming');
    await win.webContents.executeJavaScript('window.__qaPromise');
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.chat-turn.assistant').getAttribute('data-state')`), 'complete');
    const citations = [{ n: 1, docId: 'qa_document', title: '工程规范示例', page: 12, ref: '5.2.6', snippet: '本段为界面验收示例，不代表实际工程规范。', sourceUrl: 'http://127.0.0.1:' + backend.server.address().port + '/?openCitation=1&doc=qa_document&page=12' }];
    const answer = '## 道路设计，先明确这三件事\n\n需要把**运输、消防和排水**一起考虑，而不是只看道路宽度。以下为界面排版示例，具体参数应核对项目适用规范。\n\n1. **确认道路用途**：区分运输道路、检修通道与消防车道。\n2. **核对宽度和转弯条件**：结合设备运输及车型，检查净宽、净高和转弯空间。[片段1]\n3. **连通竖向设计**：根据实际距离、坡向和控制标高校核积水风险。\n\n| 检查项 | 需要补充的资料 |\n| --- | --- |\n| 道路条件 | 设备尺寸、运输车辆、消防要求 |\n| 排水条件 | 控制标高、实际距离、排水出口 |\n\n> 建议先补齐项目条件，再逐条核对规范来源。';
    await win.webContents.executeJavaScript(`(() => { newChat();appendUserTurn('储能站的道路设计，应该从哪些方面开始核对？'); const t=appendAssistantTurn();t.note.textContent='资料库增强回答 · 示例';SpecFlowChatView.update(t,${JSON.stringify(answer)},${JSON.stringify(citations)},answerHtml,citationCard);SpecFlowChatView.setState(t,'complete');window.__qaTurn=t;document.getElementById('assistantEmpty').style.display='none';CHAT_FOLLOW=false;document.querySelector('.assistant-stream').scrollTop=0;syncChatJump(); })()`);
    await capture('conversation-dark');
    const computed = await win.webContents.executeJavaScript(`(() => { const a=document.querySelector('.qa-answer'),s=getComputedStyle(a);return {border:s.borderTopWidth,background:s.backgroundColor,before:getComputedStyle(a,'::before').content,weight:s.fontWeight}; })()`);
    assert.equal(computed.border, '0px'); assert.equal(computed.background, 'rgba(0, 0, 0, 0)'); assert.equal(computed.weight, '400'); assert.equal(computed.before, 'none');
    await win.webContents.executeJavaScript(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copied=value;}}});document.querySelector('[data-act="copyAnswer"]').click()`);
    await waitFor('!!window.__copied'); assert.match(await win.webContents.executeJavaScript('window.__copied'), /工程规范示例/);
    await win.webContents.executeJavaScript(`window.openCitation=(...args)=>{window.__citation=args;};document.querySelector('.qa-answer .citation-link').click()`);
    assert.equal((await win.webContents.executeJavaScript('window.__citation'))[0], 'qa_document');
    const codeAnswer = answer + '\n\n```js\nconst slope = 0.005;\n```';
    await win.webContents.executeJavaScript(`SpecFlowChatView.update(window.__qaTurn,${JSON.stringify(codeAnswer)},${JSON.stringify(citations)},answerHtml,citationCard);document.querySelector('[data-act="copyCode"]').click()`);
    await waitFor(`window.__copied==='const slope = 0.005;'`);
    await win.webContents.executeJavaScript(`SpecFlowChatView.update(window.__qaTurn,${JSON.stringify(answer)},${JSON.stringify(citations)},answerHtml,citationCard);document.querySelector('.chat-sources').open=true;scrollConversation(true)`); await capture('sources-expanded');
    assert.equal(await win.webContents.executeJavaScript(`(() => { const c=document.querySelector('.qa-cites .cite').getBoundingClientRect(),s=document.querySelector('.assistant-stream').getBoundingClientRect();return c.top>=s.top && c.bottom<=s.bottom; })()`), true);
    await win.webContents.executeJavaScript(`document.querySelector('.chat-sources').open=false;document.documentElement.setAttribute('data-theme','light');CHAT_FOLLOW=false;document.querySelector('.assistant-stream').scrollTop=0`); await capture('conversation-light');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.qa-answer')).color`), 'rgb(21, 38, 58)');
    win.setSize(980, 820); await capture('conversation-compact');
    assert.equal(await win.webContents.executeJavaScript(`document.querySelector('.assistant-stream').scrollWidth <= document.querySelector('.assistant-stream').clientWidth`), true);
    assert.equal(await win.webContents.executeJavaScript(`Array.from(document.querySelectorAll('.title-tool,.window-button')).every(b=>{const r=b.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth;})`), true);
    await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    await win.webContents.executeJavaScript(`SpecFlowChatView.setState(window.__qaTurn,'pending')`);
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.chat-typing i')).animationName`), 'none');
    assert.equal(await win.webContents.executeJavaScript(`getComputedStyle(document.querySelector('.chat-state-dot')).animationName`), 'none');
    win.webContents.debugger.detach();
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log(JSON.stringify({ passed: true, streaming: true, readingPosition: true, inlineCitations: true, copy: true, themes: ['dark', 'light'], compact: true, reducedMotion: true, output }));
  } catch (error) { console.error(error.stack); app.exitCode = 1; }
  finally { backend?.service.shutdown(); backend?.server.close(); stub?.close(); if (win && !win.isDestroyed()) win.destroy(); app.exit(app.exitCode || 0); }
});

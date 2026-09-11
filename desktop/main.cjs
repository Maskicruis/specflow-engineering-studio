'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { UpdateManager } = require('./update-manager.cjs');
const { HarnessRuntime } = require('./harness-runtime.cjs');
const { fetchDeepSeekBalance } = require('./deepseek-balance.cjs');
const updateConfig = require('../build/update-config.json');
const packageMetadata = require('../package.json');

let backend = null;
let mainWindow = null;
let runtimeInfo = null;
let updater = null;
let harnessRuntime = null;
let desktopPreferences = { autoCheckUpdates: true, harnessAutoStart: true, harnessPort: 3080, harnessWorkspace: '' };

function preferencesPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPreferences() {
  try {
    const saved = JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'));
    const port = Number(saved.harnessPort);
    desktopPreferences = {
      ...desktopPreferences,
      autoCheckUpdates: saved.autoCheckUpdates !== false,
      harnessAutoStart: saved.harnessAutoStart !== false,
      harnessPort: Number.isInteger(port) && port >= 1024 && port <= 65535 ? port : 3080,
      harnessWorkspace: typeof saved.harnessWorkspace === 'string' ? saved.harnessWorkspace : ''
    };
  } catch {
    desktopPreferences = { autoCheckUpdates: true, harnessAutoStart: true, harnessPort: 3080, harnessWorkspace: '' };
  }
  return { ...desktopPreferences };
}

function saveDesktopPreferences(patch) {
  desktopPreferences = { ...desktopPreferences, ...patch };
  const target = preferencesPath();
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(desktopPreferences, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, target);
  return { ...desktopPreferences };
}

function defaultHarnessWorkspace() {
  return path.join(app.getPath('documents'), 'SpecFlow Engineering Studio', 'Agent Workspace');
}

function harnessOptions() {
  return {
    port: desktopPreferences.harnessPort,
    workspace: desktopPreferences.harnessWorkspace || defaultHarnessWorkspace(),
    knowledgeBaseUrl: runtimeInfo ? `http://${runtimeInfo.host}:${runtimeInfo.port}` : 'http://127.0.0.1:8790'
  };
}

function listen(server, port, host) {
  return new Promise((resolve, reject) => {
    const onError = error => { server.off('listening', onListening); reject(error); };
    const onListening = () => { server.off('error', onError); resolve(server.address()); };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port, host);
  });
}

async function startBackend() {
  const captureDataDir = process.env.SPECFLOW_CAPTURE_PATH && process.env.SPECFLOW_CAPTURE_DATA_DIR;
  const dataDir = captureDataDir ? path.resolve(captureDataDir) : path.join(app.getPath('userData'), 'data');
  const firstRun = !fs.existsSync(path.join(dataDir, 'settings.json'));
  process.env.KB_DATA_DIR = dataDir;

  const { createHttpServer } = require('../src/http-server');
  backend = createHttpServer();
  if (firstRun) {
    backend.service.updateSettings({
      library: path.join(app.getPath('documents'), 'SpecFlow Engineering Studio', '文档数据库')
    });
  }

  const configuredPort = Number(backend.service.settings.port) || 8790;
  const host = '127.0.0.1';
  let address;
  let fallback = false;
  try {
    address = await listen(backend.server, configuredPort, host);
  } catch (error) {
    if (!error || error.code !== 'EADDRINUSE') throw error;
    backend = createHttpServer({ service: backend.service });
    address = await listen(backend.server, 0, host);
    fallback = true;
  }
  runtimeInfo = {
    host,
    port: address.port,
    configuredPort,
    fallback,
    url: `http://${host}:${address.port}/?desktop=1`,
    dataDir,
    library: backend.service.settings.library
  };
  return runtimeInfo;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function registerIpc() {
  ipcMain.on('window:minimize', () => mainWindow?.minimize());
  ipcMain.on('window:toggle-maximize', () => {
    if (!mainWindow) return;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
  });
  ipcMain.on('window:close', () => mainWindow?.close());
  ipcMain.handle('window:is-maximized', () => Boolean(mainWindow?.isMaximized()));
  ipcMain.handle('desktop:info', () => ({ ...runtimeInfo, version: packageMetadata.version }));
  ipcMain.handle('dialog:choose-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择知识库目录',
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('dialog:choose-mineru', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 MinerU 可执行文件',
      properties: ['openFile'],
      filters: [{ name: '可执行文件', extensions: ['exe', 'cmd', 'bat'] }, { name: '所有文件', extensions: ['*'] }]
    });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('harness:choose-workspace', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择 DeepSeek Harness 项目目录',
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('desktop:open-data', () => shell.openPath(runtimeInfo.dataDir));
  ipcMain.handle('harness:status', () => harnessRuntime ? harnessRuntime.getStatus() : { phase: 'idle', message: 'Harness 尚未初始化', url: '' });
  ipcMain.handle('harness:start', () => harnessRuntime.start(harnessOptions()));
  ipcMain.handle('harness:restart', () => harnessRuntime.restart(harnessOptions()));
  ipcMain.handle('harness:preferences', () => ({
    autoStart: desktopPreferences.harnessAutoStart,
    port: desktopPreferences.harnessPort,
    workspace: desktopPreferences.harnessWorkspace || defaultHarnessWorkspace()
  }));
  ipcMain.handle('harness:set-preferences', async (_event, patch = {}) => {
    const port = Number(patch.port);
    if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Harness 端口必须是 1024–65535 的整数');
    const previous = harnessOptions();
    saveDesktopPreferences({
      harnessAutoStart: patch.autoStart !== false,
      harnessPort: port,
      harnessWorkspace: String(patch.workspace || '').trim() || defaultHarnessWorkspace()
    });
    const next = harnessOptions();
    harnessRuntime.configure(next);
    if (previous.port !== next.port || previous.workspace !== next.workspace) return harnessRuntime.restart(next);
    if (desktopPreferences.harnessAutoStart && harnessRuntime.getStatus().phase !== 'running') return harnessRuntime.start(next);
    return harnessRuntime.getStatus();
  });
  ipcMain.handle('harness:register-project', async (_event, workspace) => {
    const resolved = path.resolve(String(workspace || ''));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error('项目目录不存在');
    if (harnessRuntime.getStatus().phase !== 'running') {
      const status = await harnessRuntime.start(harnessOptions());
      if (status.phase !== 'running') throw new Error(status.message || 'Harness 尚未就绪');
    }
    return harnessRuntime.registerWorkspace(resolved);
  });
  ipcMain.handle('balance:get', async () => {
    const primary = await fetchDeepSeekBalance();
    if (primary.configured !== false) return primary;
    const llm = backend?.service?.settings?.llm || {};
    if (!/deepseek/i.test(String(llm.baseUrl || '')) || !String(llm.apiKey || '').trim()) return primary;
    return fetchDeepSeekBalance({ apiKey: llm.apiKey });
  });
  ipcMain.handle('updates:status', () => updater.getStatus());
  ipcMain.handle('updates:check', () => updater.check());
  ipcMain.handle('updates:download', () => updater.download());
  ipcMain.handle('updates:install', async () => {
    try { await harnessRuntime?.stop(); } catch (error) { console.warn('Harness stop before update failed:', error); }
    const result = updater.install();
    if (result.launched) setTimeout(() => app.quit(), 900);
    return result;
  });
  ipcMain.handle('updates:preferences', () => ({ ...desktopPreferences }));
  ipcMain.handle('updates:set-auto-check', (_event, enabled) => saveDesktopPreferences({ autoCheckUpdates: Boolean(enabled) }));
  ipcMain.handle('updates:open-release', () => {
    const url = updater.getStatus().releaseUrl;
    return url ? shell.openExternal(url) : false;
  });
}

function createMainWindow(url) {
  const capturePath = process.env.SPECFLOW_CAPTURE_PATH;
  const capturePage = process.env.SPECFLOW_CAPTURE_PAGE;
  const captureSettings = process.env.SPECFLOW_CAPTURE_SETTINGS === '1';
  let captureCitation = null;
  try { captureCitation = JSON.parse(process.env.SPECFLOW_CAPTURE_CITATION || 'null'); } catch { captureCitation = null; }
  let captureChat = null;
  try { captureChat = JSON.parse(process.env.SPECFLOW_CAPTURE_CHAT || 'null'); } catch { captureChat = null; }
  mainWindow = new BrowserWindow({
    width: 1460,
    height: 920,
    minWidth: 980,
    minHeight: 650,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    backgroundColor: '#0d0f12',
    title: 'SpecFlow Engineering Studio',
    icon: path.join(__dirname, '..', 'build', 'app.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
      spellcheck: true
    }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.once('ready-to-show', () => {
    if (!capturePath) mainWindow?.show();
  });
  if (capturePath) {
    mainWindow.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        try {
          if (capturePage === 'agent' && harnessRuntime) await harnessRuntime.start(harnessOptions());
          if (capturePage) {
            await mainWindow.webContents.executeJavaScript(`showPage(${JSON.stringify(capturePage)})`);
            await new Promise(resolve => setTimeout(resolve, capturePage === 'agent' ? 1600 : 180));
          }
          if (captureSettings) {
            await mainWindow.webContents.executeJavaScript("(()=>{const panel=document.getElementById('settingsSection');panel.style.animation='none';panel.open=true;document.body.classList.add('settings-open');panel.scrollTop=panel.scrollHeight})()");
            await new Promise(resolve => setTimeout(resolve, 260));
          }
          if (captureChat && captureChat.question) {
            await mainWindow.webContents.executeJavaScript(`(()=>{const p=${JSON.stringify(captureChat)};showPage('assistant');appendUserTurn(p.question);const turn=appendAssistantTurn();const empty=document.getElementById('assistantEmpty');if(empty)empty.style.display='none';turn.note.textContent=p.label||'资料库增强回答';turn.answer.innerHTML=answerHtml(p.answer||'',p.citations||[]);turn.cites.innerHTML=(p.citations||[]).map(citationCard).join('');document.getElementById('qState').textContent=(p.label||'资料库增强回答')+' · 引用 '+(p.citations||[]).length+' 条'})()`);
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          if (captureCitation && captureCitation.docId) {
            await mainWindow.webContents.executeJavaScript(`openCitation(${JSON.stringify(captureCitation.docId)},${Number(captureCitation.page) || 1},${JSON.stringify(captureCitation.ref || '')},${JSON.stringify(captureCitation.bbox || '')},${JSON.stringify(captureCitation.bboxNormalized || '')},${JSON.stringify(captureCitation.itemId || '')})`);
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
          const image = await mainWindow.webContents.capturePage();
          fs.writeFileSync(path.resolve(capturePath), image.toPNG());
        } finally {
          app.quit();
        }
      }, 700);
    });
  }
  mainWindow.on('maximize', () => send('window:maximized', true));
  mainWindow.on('unmaximize', () => send('window:maximized', false));
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.webContents.setWindowOpenHandler(({ url: target }) => {
    if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-attach-webview', (event, webPreferences, params) => {
    delete webPreferences.preload;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    webPreferences.sandbox = true;
    try {
      const target = new URL(params.src || `http://127.0.0.1:${desktopPreferences.harnessPort}`);
      if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || Number(target.port || 80) !== desktopPreferences.harnessPort) event.preventDefault();
    } catch { event.preventDefault(); }
  });
  mainWindow.webContents.on('did-attach-webview', (_event, contents) => {
    contents.setWindowOpenHandler(({ url: target }) => {
      if (/^https?:\/\//i.test(target)) shell.openExternal(target);
      return { action: 'deny' };
    });
    contents.on('will-navigate', (event, target) => {
      try {
        const next = new URL(target);
        if (next.hostname === '127.0.0.1' && Number(next.port || 80) === desktopPreferences.harnessPort) return;
      } catch {}
      event.preventDefault();
      if (/^https?:\/\//i.test(target)) shell.openExternal(target);
    });
  });
  mainWindow.loadURL(url);
  if (desktopPreferences.autoCheckUpdates && app.isPackaged && !capturePath) {
    setTimeout(() => updater.check(), 6000);
  }
}

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('studio.specflow.engineering');
    Menu.setApplicationMenu(null);
    loadDesktopPreferences();
    updater = new UpdateManager({
      currentVersion: packageMetadata.version,
      repository: updateConfig.repository,
      updateDir: path.join(app.getPath('userData'), 'updates')
    });
    updater.on('status', status => send('updates:status', status));
    registerIpc();
    const runtime = await startBackend();
    harnessRuntime = new HarnessRuntime(harnessOptions());
    harnessRuntime.on('status', status => send('harness:status', status));
    createMainWindow(runtime.url);
    if (desktopPreferences.harnessAutoStart && !process.env.SPECFLOW_CAPTURE_PATH) {
      harnessRuntime.start(harnessOptions()).catch(error => send('harness:status', { phase: 'error', message: error.message || String(error), url: '' }));
    }
  }).catch(error => {
    dialog.showErrorBox('SpecFlow 启动失败', error && error.message ? error.message : String(error));
    app.quit();
  });
}

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0 && runtimeInfo) createMainWindow(runtimeInfo.url);
});

app.on('window-all-closed', () => {
  if (backend && backend.server.listening) backend.server.close();
  if (process.platform !== 'darwin') Promise.resolve(harnessRuntime?.stop()).finally(() => app.quit());
});

app.on('before-quit', () => {
  if (harnessRuntime?.child) harnessRuntime.child.kill();
});

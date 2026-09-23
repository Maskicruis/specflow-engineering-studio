'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { UpdateManager } = require('./update-manager.cjs');
const { connectorStatus, installConnector, writeDiscovery } = require('./harness-connector.cjs');
const { fetchDeepSeekBalance } = require('./deepseek-balance.cjs');
const { DesignToolRegistry } = require('./design-tools.cjs');
const updateConfig = require('../build/update-config.json');
const packageMetadata = require('../package.json');

let backend = null;
let mainWindow = null;
let runtimeInfo = null;
let updater = null;
let designTools = null;
const toolWindows = new Map();
let desktopPreferences = { autoCheckUpdates: true };

const BUILT_IN_TOOL_WINDOWS = Object.freeze({
  'road-slope': {
    title: '道路排水坡度设计 · SpecFlow',
    route: '/tools/road-slope',
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 620
  }
});

function preferencesPath() {
  return path.join(app.getPath('userData'), 'desktop-preferences.json');
}

function loadDesktopPreferences() {
  try {
    const saved = JSON.parse(fs.readFileSync(preferencesPath(), 'utf8'));
    desktopPreferences = {
      ...desktopPreferences,
      autoCheckUpdates: saved.autoCheckUpdates !== false
    };
  } catch {
    desktopPreferences = { autoCheckUpdates: true };
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
  try {
    writeDiscovery({
      baseUrl: `http://${host}:${address.port}`,
      pid: process.pid,
      appVersion: packageMetadata.version,
      startedAt: new Date().toISOString()
    });
  } catch (error) {
    console.warn('Unable to publish DeepSeek Harness connector discovery:', error.message || String(error));
  }
  return runtimeInfo;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function openCitationInMain(payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed() || !payload.docId) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  const script = `openCitation(${JSON.stringify(String(payload.docId))},${Math.max(1, Number(payload.page) || 1)},${JSON.stringify(String(payload.ref || ''))},${JSON.stringify(payload.bbox || '')},${JSON.stringify(payload.bboxNormalized || '')},${JSON.stringify(String(payload.itemId || ''))})`;
  const execute = () => mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents.executeJavaScript(script).catch(error => console.warn('Unable to open citation:', error.message || String(error)));
  if (mainWindow.webContents.isLoadingMainFrame()) mainWindow.webContents.once('did-finish-load', execute);
  else execute();
}

function openBuiltInToolWindow(toolId) {
  const id = String(toolId || '');
  const definition = BUILT_IN_TOOL_WINDOWS[id];
  if (!definition) throw new Error('内置设计工具不存在');
  const current = toolWindows.get(id);
  if (current && !current.isDestroyed()) {
    if (current.isMinimized()) current.restore();
    current.show();
    current.focus();
    return { id, opened: true, reused: true };
  }
  if (!runtimeInfo) throw new Error('SpecFlow 本地服务尚未就绪');
  const toolWindow = new BrowserWindow({
    width: definition.width,
    height: definition.height,
    minWidth: definition.minWidth,
    minHeight: definition.minHeight,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#0c0f14',
    title: definition.title,
    icon: path.join(__dirname, '..', 'build', 'app.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: false,
      spellcheck: true
    }
  });
  toolWindows.set(id, toolWindow);
  toolWindow.setMenuBarVisibility(false);
  toolWindow.once('ready-to-show', () => toolWindow.show());
  toolWindow.on('closed', () => {
    if (toolWindows.get(id) === toolWindow) toolWindows.delete(id);
  });
  toolWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  const toolUrl = new URL(definition.route, runtimeInfo.url);
  toolUrl.searchParams.set('desktop', '1');
  toolWindow.loadURL(toolUrl.toString());
  return { id, opened: true, reused: false };
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
  ipcMain.handle('dialog:choose-project-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择工程项目保存目录',
      properties: ['openDirectory', 'createDirectory']
    });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('dialog:choose-design-tool', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择设计工具程序',
      properties: ['openFile'],
      filters: [{ name: 'Windows 程序', extensions: ['exe', 'cmd', 'bat'] }]
    });
    return result.canceled ? '' : result.filePaths[0];
  });
  ipcMain.handle('desktop:open-data', () => shell.openPath(runtimeInfo.dataDir));
  ipcMain.handle('project:open-directory', (_event, target) => {
    const resolved = path.resolve(String(target || ''));
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) throw new Error('工程目录不存在');
    return shell.openPath(resolved);
  });
  ipcMain.handle('design-tools:list', () => designTools.list());
  ipcMain.handle('design-tools:update', (_event, id, patch) => designTools.update(id, patch));
  ipcMain.handle('design-tools:launch', (_event, id) => designTools.launch(id));
  ipcMain.handle('design-tools:open-window', (_event, id) => openBuiltInToolWindow(id));
  ipcMain.handle('balance:get', () => fetchDeepSeekBalance());
  ipcMain.handle('connector:status', () => connectorStatus());
  ipcMain.handle('connector:install', () => installConnector());
  ipcMain.handle('connector:open-profile', () => shell.openPath(connectorStatus().profile));
  ipcMain.handle('updates:status', () => updater.getStatus());
  ipcMain.handle('updates:check', () => updater.check());
  ipcMain.handle('updates:download', () => updater.download());
  ipcMain.handle('updates:install', async () => {
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
  const captureTool = process.env.SPECFLOW_CAPTURE_TOOL;
  const captureSettings = process.env.SPECFLOW_CAPTURE_SETTINGS === '1';
  let captureCitation = null;
  try { captureCitation = JSON.parse(process.env.SPECFLOW_CAPTURE_CITATION || 'null'); } catch { captureCitation = null; }
  let captureChat = null;
  try { captureChat = JSON.parse(process.env.SPECFLOW_CAPTURE_CHAT || 'null'); } catch { captureChat = null; }
  mainWindow = new BrowserWindow({
    width: captureTool ? 1280 : 1460,
    height: captureTool ? 820 : 920,
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
      webviewTag: false,
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
          if (capturePage && !captureTool) {
            await mainWindow.webContents.executeJavaScript(`showPage(${JSON.stringify(capturePage === 'agent' ? 'assistant' : capturePage)})`);
            await new Promise(resolve => setTimeout(resolve, 180));
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
  const initialUrl = captureTool ? new URL(`/tools/${captureTool}`, url).toString() : url;
  mainWindow.loadURL(initialUrl);
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
    designTools = new DesignToolRegistry({ dataDir: app.getPath('userData') });
    updater.on('status', status => send('updates:status', status));
    registerIpc();
    const runtime = await startBackend();
    backend.server.on('specflow:open-citation', openCitationInMain);
    createMainWindow(runtime.url);
  }).catch(error => {
    dialog.showErrorBox('SpecFlow 启动失败', error && error.message ? error.message : String(error));
    app.quit();
  });
}

app.on('activate', () => {
  if ((!mainWindow || mainWindow.isDestroyed()) && runtimeInfo) createMainWindow(runtimeInfo.url);
});

app.on('window-all-closed', () => {
  if (backend && backend.server.listening) backend.server.close();
  if (process.platform !== 'darwin') app.quit();
});

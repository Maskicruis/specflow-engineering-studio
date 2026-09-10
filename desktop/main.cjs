'use strict';

const { app, BrowserWindow, dialog, ipcMain, Menu, shell } = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let backend = null;
let mainWindow = null;
let runtimeInfo = null;

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
  const dataDir = path.join(app.getPath('userData'), 'data');
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
  ipcMain.handle('desktop:info', () => ({ ...runtimeInfo, version: app.getVersion() }));
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
  ipcMain.handle('desktop:open-data', () => shell.openPath(runtimeInfo.dataDir));
}

function createMainWindow(url) {
  const capturePath = process.env.SPECFLOW_CAPTURE_PATH;
  const capturePage = process.env.SPECFLOW_CAPTURE_PAGE;
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
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
          if (capturePage) {
            await mainWindow.webContents.executeJavaScript(`showPage(${JSON.stringify(capturePage)})`);
            await new Promise(resolve => setTimeout(resolve, 180));
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
  mainWindow.loadURL(url);
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
    registerIpc();
    const runtime = await startBackend();
    createMainWindow(runtime.url);
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
  if (process.platform !== 'darwin') app.quit();
});

'use strict';

const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('specflowDesktop', {
  app: {
    info: () => ipcRenderer.invoke('desktop:info'),
    openDataFolder: () => ipcRenderer.invoke('desktop:open-data')
  },
  dialog: {
    chooseDirectory: () => ipcRenderer.invoke('dialog:choose-directory'),
    chooseMineru: () => ipcRenderer.invoke('dialog:choose-mineru'),
    chooseProjectDirectory: () => ipcRenderer.invoke('dialog:choose-project-directory'),
    chooseDesignTool: () => ipcRenderer.invoke('dialog:choose-design-tool')
  },
  balance: {
    get: () => ipcRenderer.invoke('balance:get')
  },
  projects: {
    openDirectory: target => ipcRenderer.invoke('project:open-directory', String(target || ''))
  },
  designTools: {
    list: () => ipcRenderer.invoke('design-tools:list'),
    update: (id, patch) => ipcRenderer.invoke('design-tools:update', String(id || ''), patch || {}),
    launch: id => ipcRenderer.invoke('design-tools:launch', String(id || '')),
    openWindow: id => ipcRenderer.invoke('design-tools:open-window', String(id || ''))
  },
  connector: {
    status: () => ipcRenderer.invoke('connector:status'),
    install: () => ipcRenderer.invoke('connector:install'),
    openProfile: () => ipcRenderer.invoke('connector:open-profile')
  },
  updates: {
    status: () => ipcRenderer.invoke('updates:status'),
    check: () => ipcRenderer.invoke('updates:check'),
    download: () => ipcRenderer.invoke('updates:download'),
    install: () => ipcRenderer.invoke('updates:install'),
    preferences: () => ipcRenderer.invoke('updates:preferences'),
    setAutoCheck: enabled => ipcRenderer.invoke('updates:set-auto-check', Boolean(enabled)),
    openRelease: () => ipcRenderer.invoke('updates:open-release'),
    onStatus: callback => subscribe('updates:status', callback)
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: callback => subscribe('window:maximized', callback)
  }
});

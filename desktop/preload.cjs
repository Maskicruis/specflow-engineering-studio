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
    chooseMineru: () => ipcRenderer.invoke('dialog:choose-mineru')
  },
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    toggleMaximize: () => ipcRenderer.send('window:toggle-maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
    onMaximized: callback => subscribe('window:maximized', callback)
  }
});


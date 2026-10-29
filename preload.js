const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('amplite', {
  platform: process.platform,
  setTheme: colors => ipcRenderer.send('theme', colors),
  setMainVisible: show => ipcRenderer.send('main-visibility', show),
  quit: () => ipcRenderer.send('quit'),
  onMedia: cb => ipcRenderer.on('media', (_e, cmd) => cb(cmd)),
  info: () => ipcRenderer.invoke('app-info'),
  checkUpdate: () => ipcRenderer.send('update-check'),
  installUpdate: () => ipcRenderer.send('update-install'),
  onUpdate: cb => ipcRenderer.on('update', (_e, s) => cb(s)),
  engineStatus: () => ipcRenderer.invoke('engine-status'),
  engineStart: vol => ipcRenderer.send('engine-start', vol),
  engineRestart: opts => ipcRenderer.send('engine-restart', opts),
  onEngine: cb => ipcRenderer.on('engine', (_e, s) => cb(s)),
});

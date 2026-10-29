const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('amplite', {
  platform: process.platform,
  setTheme: colors => ipcRenderer.send('theme', colors),
  setMainVisible: show => ipcRenderer.send('main-visibility', show),
  quit: () => ipcRenderer.send('quit'),
  onMedia: cb => ipcRenderer.on('media', (_e, cmd) => cb(cmd)),
});

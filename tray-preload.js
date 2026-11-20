// Bridge for the tray quick panel: read what's playing, send a control command, open Amplite.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('panel', {
  now: () => ipcRenderer.invoke('panel-now'),
  cmd: c => ipcRenderer.send('panel-cmd', String(c)),
  open: () => ipcRenderer.send('panel-open'),
  onShow: f => ipcRenderer.on('panel-show', () => f()),
});

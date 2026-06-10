const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFileBytes: (filePath) => ipcRenderer.invoke('file:readBytes', filePath)
});
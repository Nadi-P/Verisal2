const { contextBridge, ipcRenderer } = require('electron');
const os = require('os');

contextBridge.exposeInMainWorld('electronAPI', {
  openFile:      () => ipcRenderer.invoke('dialog:openFile'),
  openFolder:    () => ipcRenderer.invoke('dialog:openFolder'),
  saveFile:      (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  readFileBytes: (filePath) => ipcRenderer.invoke('file:readBytes', filePath),
  writeFileBytes: (filePath, data) => ipcRenderer.invoke('file:writeBytes', filePath, data),
  getOSUser:     () => {
    try {
      const info = os.userInfo();
      return info.username || null;
    } catch (e) {
      return null;
    }
  },
});

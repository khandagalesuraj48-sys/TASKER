// electron/preload.cjs
const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop API to the renderer process
contextBridge.exposeInMainWorld('electron', {
  platform: 'windows',
  isDesktop: true,
  getVersion: () => ipcRenderer.invoke('get-version'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  downloadUpdate: (url) => ipcRenderer.invoke('download-update', url),
  installUpdate: (filePath) => ipcRenderer.invoke('install-update', filePath),
  showNotification: (options) => ipcRenderer.invoke('show-notification', options),
  onUpdateProgress: (callback) => {
    const subscription = (event, progress) => callback(progress);
    ipcRenderer.on('update-progress', subscription);
    return () => ipcRenderer.removeListener('update-progress', subscription);
  }
});

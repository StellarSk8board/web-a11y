const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('webA11y', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  selectZip: () => ipcRenderer.invoke('select-zip'),
  processFolder: (folderPath, options) => ipcRenderer.invoke('process-folder', folderPath, options),
  processZip: (zipPath, options) => ipcRenderer.invoke('process-zip', zipPath, options),
  saveFixedZip: (report) => ipcRenderer.invoke('save-fixed-zip', report),
  checkOllama: () => ipcRenderer.invoke('check-ollama'),
  onEngineProgress: (callback) => ipcRenderer.on('engine-progress', (e, p) => callback(p)),
  onAiProgress: (callback) => ipcRenderer.on('ai-progress', (e, p) => callback(p))
});

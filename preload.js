const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld(
  'electronAPI', {
    submitForm: (data) => ipcRenderer.send('form:submit', data),
    onUpdate: (callback) => ipcRenderer.on('update-status', (_event, value) => callback(value)),
    convertTxtToCsv: (filePath) => ipcRenderer.send('convert-txt-to-csv', filePath),
    onConvertTxtToCsvReply: (callback) => ipcRenderer.on('convert-txt-to-csv-reply', (_event, ...args) => callback(...args)),
    logToTerminal: (message) => ipcRenderer.send('log-to-terminal', message),
    exportMasterPrompt: (data) => ipcRenderer.send('export-master-prompt', data),
    onExportMasterPromptReply: (callback) => ipcRenderer.on('export-master-prompt-reply', (_event, ...args) => callback(...args))
  }
);

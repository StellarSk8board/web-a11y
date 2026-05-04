const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { Engine } = require('./engine/rules-engine');
const { OllamaAI } = require('./engine/ai-review');
const JSZip = require('jszip');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 700,
    minHeight: 600,
    title: 'Web A11y',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC Handlers ─────────────────────────────────────────────────────────────

// Select folder via native dialog
ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Select ZIP file via native dialog
ipcMain.handle('select-zip', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Process a website from a folder path
ipcMain.handle('process-folder', async (event, folderPath, options) => {
  const engine = new Engine(options);
  const ai = new OllamaAI();

  try {
    const report = await engine.processFolder(folderPath, (progress) => {
      mainWindow.webContents.send('engine-progress', progress);
    });

    // AI enhancements for files that need it
    const aiEnhanced = await ai.enhanceReport(report, (progress) => {
      mainWindow.webContents.send('ai-progress', progress);
    });

    return { success: true, report: aiEnhanced };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Process a ZIP file
ipcMain.handle('process-zip', async (event, zipPath, options) => {
  const engine = new Engine(options);
  const ai = new OllamaAI();

  try {
    const report = await engine.processZip(zipPath, (progress) => {
      mainWindow.webContents.send('engine-progress', progress);
    });

    const aiEnhanced = await ai.enhanceReport(report, (progress) => {
      mainWindow.webContents.send('ai-progress', progress);
    });

    return { success: true, report: aiEnhanced };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Save the fixed website as a ZIP
ipcMain.handle('save-fixed-zip', async (event, report) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Fixed Website',
    defaultPath: 'website-accessible.zip',
    filters: [{ name: 'ZIP Files', extensions: ['zip'] }]
  });

  if (result.canceled) return { success: false, canceled: true };

  try {
    const zip = new JSZip();
    for (const [filepath, content] of Object.entries(report.fixedFiles)) {
      zip.file(filepath, content);
    }
    const data = await zip.generateAsync({ type: 'nodebuffer' });
    fs.writeFileSync(result.filePath, data);
    return { success: true, path: result.filePath };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// Check if Ollama is available
ipcMain.handle('check-ollama', async () => {
  const ai = new OllamaAI();
  const status = await ai.checkStatus();
  return status;
});

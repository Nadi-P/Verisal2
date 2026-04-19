import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process'; // Essential for running the Python EXE

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pythonProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, // Security best practice
      contextIsolation: true, 
    },
  });

  // 1. START THE PYTHON BACKEND
  // If packaged, verisal-backend.exe is in 'resources/backend' folder. If dev, it's in the UI folder.
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'verisal-backend.exe')
    : path.join(__dirname, 'verisal-backend.exe');

  pythonProcess = spawn(backendPath);

  pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));

  // 2. LOAD THE UI
  if (app.isPackaged) {
    // Load the local built files in production
    win.loadFile(path.join(__dirname, 'dist', 'index.html'));
  } else {
    // Load the dev server during development
    win.loadURL('http://localhost:5173');
  }
}

// --- Native Dialog Logic ---
ipcMain.handle('dialog:openFile', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    filters: [{ name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] }],
    properties: ['openFile']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  return canceled ? null : filePath;
});

app.whenReady().then(createWindow);

// 3. CLEAN UP ON CLOSE
app.on('window-all-closed', () => {
  // Kill the Python backend so it doesn't leave a ghost process
  if (pythonProcess) {
    pythonProcess.kill();
  }
  if (process.platform !== 'darwin') app.quit();
});
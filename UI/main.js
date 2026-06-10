import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, exec } from 'child_process'; // Essential for running the Python EXE

const __dirname = path.dirname(fileURLToPath(import.meta.url));
let pythonProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
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

ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('file:readBytes', async (event, filePath) => {
  const buf = await fs.promises.readFile(filePath);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
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
// On Windows, pythonProcess.kill() only signals the top-level PyInstaller
// launcher — the uvicorn child keeps the port bound. Use taskkill with
// /T (tree) and /F (force) to terminate the whole process tree.
function killBackend() {
  if (!pythonProcess || pythonProcess.killed) return;
  const pid = pythonProcess.pid;
  pythonProcess.killed = true;
  if (process.platform === 'win32') {
    exec(`taskkill /pid ${pid} /T /F`, () => {});
  } else {
    try { process.kill(-pid, 'SIGTERM'); } catch { pythonProcess.kill('SIGTERM'); }
  }
}

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killBackend);
app.on('will-quit', killBackend);
process.on('exit', killBackend);
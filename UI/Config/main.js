import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn, exec, execSync } from 'child_process'; // Essential for running the Python EXE

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_PORT = 8000;
let pythonProcess = null;

// Find and kill anything currently LISTENING on the backend port. We use
// this both at startup (to clear orphans from a previous bad shutdown) and
// at close (because PyInstaller's --onefile launcher exits the moment it
// forks the real python child, so killing by the spawned PID often misses
// the actual port-holder).
function freeBackendPort() {
  if (process.platform !== 'win32') return Promise.resolve();
  return new Promise((resolve) => {
    exec(`netstat -ano -p tcp | findstr :${BACKEND_PORT}`, (err, stdout) => {
      if (!stdout) return resolve();
      const pids = new Set();
      for (const line of stdout.split('\n')) {
        const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      if (pids.size === 0) return resolve();
      let pending = pids.size;
      for (const pid of pids) {
        exec(`taskkill /pid ${pid} /T /F`, () => {
          if (--pending === 0) resolve();
        });
      }
    });
  });
}

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
  // If packaged, verisal-backend.exe is in 'resources/backend'. In dev it sits
  // in the UI folder (one level up from Config/).
  const backendPath = app.isPackaged
    ? path.join(process.resourcesPath, 'backend', 'verisal-backend.exe')
    : path.join(__dirname, '..', 'verisal-backend.exe');

  pythonProcess = spawn(backendPath);

  pythonProcess.stdout.on('data', (data) => console.log(`Python: ${data}`));
  pythonProcess.stderr.on('data', (data) => console.error(`Python Error: ${data}`));

  // 2. LOAD THE UI
  if (app.isPackaged) {
    // Load the local built files in production (dist/ is at the app root,
    // one level up from Config/).
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  } else {
    // Load the dev server during development
    win.loadURL('http://localhost:5173');
  }

  // 3. Disable DevTools in production
  if (app.isPackaged) {
    win.webContents.on('before-input-event', (event, input) => {
      const key = (input.key || '').toLowerCase();
      if (input.control && input.shift && key === 'i') event.preventDefault();
      if (input.key === 'F12') event.preventDefault();
      if (input.control && input.shift && key === 'c') event.preventDefault();
    });
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

ipcMain.handle('file:writeBytes', async (event, filePath, data) => {
  // `data` arrives as an ArrayBuffer (e.g. a SheetJS-built .xlsx). Write it
  // to the path the user picked in the save dialog.
  await fs.promises.writeFile(filePath, Buffer.from(data));
  return true;
});

ipcMain.handle('dialog:saveFile', async (event, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }]
  });
  return canceled ? null : filePath;
});

app.whenReady().then(async () => {
  await freeBackendPort();
  createWindow();
});

// 4. CLEAN UP ON CLOSE
// On Windows, pythonProcess.kill() only signals the top-level PyInstaller
// launcher — the uvicorn child keeps the port bound. Use taskkill with
// /T (tree) and /F (force) to terminate the whole process tree.
function killBackend() {
  if (process.platform === 'win32') {
    // Synchronous on the close path — Electron tears down before async
    // exec children can finish, so the port-holder would otherwise survive.
    // Don't trust the spawned PID either; the PyInstaller --onefile launcher
    // has already exited and the real child is no longer a descendant.
    try {
      const out = execSync(`netstat -ano -p tcp | findstr :${BACKEND_PORT}`, { encoding: 'utf8' });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const m = line.trim().match(/LISTENING\s+(\d+)\s*$/);
        if (m) pids.add(m[1]);
      }
      for (const pid of pids) {
        try { execSync(`taskkill /pid ${pid} /T /F`); } catch {}
      }
    } catch {}
    return;
  }
  if (!pythonProcess || pythonProcess.killed) return;
  pythonProcess.killed = true;
  try { process.kill(-pythonProcess.pid, 'SIGTERM'); } catch { pythonProcess.kill('SIGTERM'); }
}

app.on('window-all-closed', () => {
  killBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', killBackend);
app.on('will-quit', killBackend);
process.on('exit', killBackend);

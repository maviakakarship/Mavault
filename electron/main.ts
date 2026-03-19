import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Use standard node path resolution
const __dirname = path.resolve();

function createWindow() {
  const win = new BrowserWindow({
    width: 1000,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'electron', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Enable screenshot/recording protection
  win.setContentProtection(true);

  // Power monitoring for sleep and screen lock
  powerMonitor.on('suspend', () => {
    win.webContents.send('trigger-lock');
  });

  powerMonitor.on('lock-screen', () => {
    win.webContents.send('trigger-lock');
  });

  win.webContents.on('did-fail-load', (event, code, desc) => {
    console.log(`Failed to load: ${desc} (${code})`);
  });

  win.loadURL('http://localhost:5173');
}

ipcMain.handle('read-vault', async () => {
  const filePath = path.join(app.getPath('documents'), 'mavault_core.sec');
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  return null;
});

ipcMain.handle('write-vault', async (_, data: string) => {
  const filePath = path.join(app.getPath('documents'), 'mavault_core.sec');
  fs.writeFileSync(filePath, data);
  return true;
});

app.whenReady().then(createWindow);

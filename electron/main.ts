import { app, BrowserWindow, ipcMain, powerMonitor } from 'electron';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.on('ready-to-show', () => {
    win.show();
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

  // In development, we load from the dev server.
  // In production, we load from the dist/renderer folder.
  if (app.isPackaged) {
    win.loadFile(path.join(__dirname, '../renderer/index.html'));
  } else {
    const devUrl = 'http://localhost:5173';
    win.loadURL(devUrl).catch(() => {
      // Fallback if dev server is on 5174 or other
      win.loadURL('http://localhost:5174');
    });
  }
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

ipcMain.handle('delete-vault', async () => {
  const filePath = path.join(app.getPath('documents'), 'mavault_core.sec');
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
  return true;
});

app.whenReady().then(createWindow);

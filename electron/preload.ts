import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
  readVault: () => ipcRenderer.invoke('read-vault'),
  writeVault: (data: string) => ipcRenderer.invoke('write-vault', data),
  deleteVault: () => ipcRenderer.invoke('delete-vault'),
  onLock: (callback: () => void) => ipcRenderer.on('trigger-lock', callback),
});

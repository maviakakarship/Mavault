"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    readVault: function () { return electron_1.ipcRenderer.invoke('read-vault'); },
    writeVault: function (data) { return electron_1.ipcRenderer.invoke('write-vault', data); },
    onLock: function (callback) { return electron_1.ipcRenderer.on('trigger-lock', callback); },
});

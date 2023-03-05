// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('meticulousAPI', {
  saveFile: (filename: string, data: any) =>
    ipcRenderer.invoke('saveFile', filename, data)
  // we can also expose variables, not just functions
});

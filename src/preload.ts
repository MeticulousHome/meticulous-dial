// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { NetworkConfig } from './types';

contextBridge.exposeInMainWorld('meticulousAPI', {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  saveFile: (filename: string, data: any) =>
    ipcRenderer.invoke('saveFile', filename, data),
  getPresetData: () => ipcRenderer.invoke('getPresetData'),
  getNetworkConfig: () => ipcRenderer.invoke('getNetworkConfig'),
  updateNetworkConfig: (newConfig: Partial<NetworkConfig>) =>
    ipcRenderer.invoke('updateNetworkConfig', newConfig)
  // we can also expose variables, not just functions
});

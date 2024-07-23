// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';
import { NetworkConfig } from './types';

contextBridge.exposeInMainWorld('meticulousAPI', {
  getNetworkConfig: () => ipcRenderer.invoke('getNetworkConfig'),
  getWifiList: () => ipcRenderer.invoke('getWifiList'),
  updateNetworkConfig: (newConfig: Partial<NetworkConfig>) =>
    ipcRenderer.invoke('updateNetworkConfig', newConfig),
  connectToWifi: (ssid: string, password: string) =>
    ipcRenderer.invoke('connectToWifi', ssid, password),
  deleteKnowWifi: ({ ssid }: { ssid: string }) =>
    ipcRenderer.invoke('deleteKnowWifi', { ssid })
  // we can also expose variables, not just functions
});

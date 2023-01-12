// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('meticulous_envs', {
  SERVER_URL: () => process.env.SERVER_URL
  // we can also expose variables, not just functions
});

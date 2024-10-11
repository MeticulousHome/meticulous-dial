import { ElectronHandler } from './preload';

declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    electron: ElectronHandler;
    env: typeof process.env;
    electron_version: string;
  }
}

export {};

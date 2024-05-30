import { PasswortConnect } from './src/types';

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
  getPresetData: () => Promise<any>;
  getNetworkConfig: () => Promise<any>;
  getWifiList: () => Promise<any>;
  updateNetworkConfig: (newConfig: Partial<NetworkConfig>) => Promise<any>;
  connectToWifi: (config: PasswortConnect) => Promise<any>;
  deleteKnowWifi: ({ ssid }: { ssid: string }) => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

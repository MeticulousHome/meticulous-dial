/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
  getPresetData: () => Promise<any>;
  getNetworkConfig: () => Promise<any>;
  updateNetworkConfig: (newConfig: Partial<NetworkConfig>) => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

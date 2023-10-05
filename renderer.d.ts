/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
  getPresetData: () => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

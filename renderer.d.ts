export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
  getPresetData: () => Promise<any>;
  getPresetSettingData: () => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

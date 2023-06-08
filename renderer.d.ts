export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
  getPresetData: () => Promise<string>;
  getPresetSettingData: () => Promise<string>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

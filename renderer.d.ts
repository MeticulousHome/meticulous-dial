export interface MeticulousAPI {
  saveFile: (filename: string, data: string) => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

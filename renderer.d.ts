export interface MeticulousAPI {
  saveFile: (filename: string) => Promise<any>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

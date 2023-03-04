export interface MeticulousAPI {
  saveFile: (filename: string) => Promise<void>;
}

declare global {
  interface Window {
    meticulousAPI: MeticulousAPI;
  }
}

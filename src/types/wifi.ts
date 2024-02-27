export enum AppMode {
  AP = 'AP',
  CLIENT = 'CLIENT'
}

export interface NetworkConfig {
  provisioning: boolean;
  mode: AppMode;
  apName: string;
  apPassword: string;
  qr?: string;
}

export interface WifiStatus {
  connected: boolean;
  connection_name: string;
  gateway: string;
  routes: string[];
  ips: string[];
  dns: string[];
  mac: string;
  hostname: string;
}

export interface Wifi {
  ssid: string;
  signal: number;
  rate: number;
  in_use: boolean;
}

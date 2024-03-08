export enum WifiMode {
  AP = 'AP',
  CLIENT = 'CLIENT'
}

export interface PasswortConnect {
  ssid: string;
  password: string;
}

export interface NetworkConfig {
  provisioning: boolean;
  mode: WifiMode;
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

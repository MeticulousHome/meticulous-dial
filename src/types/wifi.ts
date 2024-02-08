export enum AppMode {
  AP = 'AP',
  CLIENT = 'CLIENT'
}

export interface NetworkConfig {
  provisioning: boolean;
  mode: AppMode;
  apName: string;
  apPassword: string;
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

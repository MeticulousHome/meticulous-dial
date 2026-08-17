import type { WifiConnectCredentials } from '../../api/wifi';

export const buildWifiConnectCredentials = (
  ssid: string,
  password: string
): WifiConnectCredentials => ({
  type: 'PSK',
  ssid,
  password
});

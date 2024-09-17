import {
  AcknowledgeNotificationRequest,
  WiFiConfig,
  WiFiConnectRequest,
  WiFiNetwork,
  WifiStatus
} from 'meticulous-api';
import { api } from './api';

export interface FixedWifiStatus extends WifiStatus {
  known_wifis: { [key: string]: string };
}

// Wrapper for getWiFiConfig
export async function getNetworkConfig(): Promise<FixedWifiStatus> {
  try {
    const response = await api.getWiFiConfig();
    return response.data as unknown as FixedWifiStatus;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching Network Config: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error fetching Network Config.'
      );
    } else {
      console.error(
        'Network error while fetching Network Config: ',
        error.message
      );
      throw new Error('Network error while fetching Network Config.');
    }
  }
}

// Wrapper for setWiFiConfig
export async function updateNetworkConfig(
  data: Partial<WiFiConfig>
): Promise<WiFiConfig> {
  try {
    const response = await api.setWiFiConfig(data);
    return response.data as WiFiConfig;
  } catch (error) {
    if (error.response) {
      console.error('Error updating Network Config: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error updating Network Config.'
      );
    } else {
      console.error(
        'Network error while updating Network Config: ',
        error.message
      );
      throw new Error('Network error while updating Network Config.');
    }
  }
}

// Wrapper for getWiFiQR
export async function getWiFiQRCode(): Promise<Blob> {
  try {
    const response = await api.getWiFiQR();
    return response.data;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching Wi-Fi QR Code: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error fetching Wi-Fi QR Code.'
      );
    } else {
      console.error(
        'Network error while fetching Wi-Fi QR Code: ',
        error.message
      );
      throw new Error('Network error while fetching Wi-Fi QR Code.');
    }
  }
}

// Wrapper for listAvailableWiFi
export async function listAvailableWiFi(): Promise<WiFiNetwork[]> {
  try {
    const response = await api.listAvailableWiFi();
    return response.data as WiFiNetwork[];
  } catch (error) {
    if (error.response) {
      console.error('Error listing available Wi-Fi: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error listing available Wi-Fi.'
      );
    } else {
      console.error(
        'Network error while listing available Wi-Fi: ',
        error.message
      );
      throw new Error('Network error while listing available Wi-Fi.');
    }
  }
}

// Wrapper for connectToWiFi
export async function connectToWiFi(data: WiFiConnectRequest): Promise<void> {
  try {
    const response = await api.connectToWiFi(data);
    return response.data as void;
  } catch (error) {
    if (error.response) {
      console.error('Error connecting to Wi-Fi: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error connecting to Wi-Fi.'
      );
    } else {
      console.error('Network error while connecting to Wi-Fi: ', error.message);
      throw new Error('Network error while connecting to Wi-Fi.');
    }
  }
}

// Wrapper for deleteWifi
export async function deleteKnownWifi(ssid: string): Promise<void> {
  try {
    const response = await api.deleteWifi({ ssid });
    return response.data as void;
  } catch (error) {
    if (error.response) {
      console.error('Error deleting known Wi-Fi: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error deleting known Wi-Fi.'
      );
    } else {
      console.error(
        'Network error while deleting known Wi-Fi: ',
        error.message
      );
      throw new Error('Network error while deleting known Wi-Fi.');
    }
  }
}

// Wrapper for acknowledgeNotification
export async function acknowledgeNotification(
  data: AcknowledgeNotificationRequest
): Promise<void> {
  try {
    const response = await api.acknowledgeNotification(data);
    return response.data as void;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching Network Config: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error fetching Network Config.'
      );
    } else {
      console.error(
        'Network error while fetching Network Config: ',
        error.message
      );
      throw new Error('Network error while fetching Network Config.');
    }
  }
}

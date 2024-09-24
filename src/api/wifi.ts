import {
  AcknowledgeNotificationRequest,
  APIError,
  WiFiConfig,
  WiFiCredentials,
  WiFiNetwork,
  WifiStatus
} from '@meticulous-home/espresso-api';
import { api } from './api';

// Wrapper for getWiFiConfig
export async function getWifiStatus(): Promise<WifiStatus> {
  try {
    const response = await api.getWiFiConfig();
    const data = response.data;
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
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
  config: Partial<WiFiConfig>
): Promise<WiFiConfig> {
  try {
    const response = await api.setWiFiConfig(config);
    const data = response.data;
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
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
    const data = response.data;
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
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
export async function connectToWiFi(config: WiFiCredentials): Promise<void> {
  try {
    const response = await api.connectToWiFi(config);
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
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
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
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
  notification: AcknowledgeNotificationRequest
): Promise<void> {
  try {
    const response = await api.acknowledgeNotification(notification);
    if (response.status === 404) {
      return;
    }
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
  } catch (error) {
    if (error.response) {
      if (error.response.status === 404) {
        return;
      }
      console.error('Error acknowledging Notification: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error acknowledging Notification'
      );
    } else {
      console.error(
        'Network error while acknowledging Notification: ',
        error.message
      );
      throw new Error('Network error while acknloedging Notification: ');
    }
  }
}

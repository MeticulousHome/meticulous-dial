import {
  AcknowledgeNotificationRequest,
  APIError,
  WiFiConfig,
  WiFiCredentials,
  WiFiNetwork,
  WifiStatus
} from '@meticulous-home/espresso-api';
import { API_URL, api } from './api';

export type WifiHealthStatus = {
  mode: string;
  link_connected: boolean;
  has_ipv4: boolean;
  gateway_reachable: boolean;
  dns_resolves: boolean;
  internet_reachable: boolean;
  ap_active: boolean;
  degraded: boolean;
  last_error: string;
  message?: string;
  last_recovery_action: string;
  last_recovery_result: string;
  verified: boolean;
};

export type KnownWifi = {
  ssid: string;
  type?: string;
};

export type ExtendedWifiStatus = WifiStatus & {
  health?: WifiHealthStatus;
  known_wifis?: Record<string, KnownWifi | string>;
};

export type WifiConnectResult = {
  status: string;
  health?: WifiHealthStatus;
};

export type WifiConnectCredentials =
  | WiFiCredentials
  | {
      type: 'PSK' | 'SAE';
      ssid: string;
      password?: string;
    };

export class WiFiConnectionError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'WiFiConnectionError';
    this.code = code;
  }
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const data = error.response.data as Partial<APIError> & {
      message?: string;
    };
    return data.error || data.message || fallback;
  }

  if (error instanceof Error) {
    return error.message || fallback;
  }

  return fallback;
}

function getApiErrorCode(error: unknown): string | undefined {
  if (
    error &&
    typeof error === 'object' &&
    'response' in error &&
    error.response &&
    typeof error.response === 'object' &&
    'data' in error.response
  ) {
    const data = error.response.data as { code?: string };
    return data.code;
  }

  return undefined;
}

// Wrapper for getWiFiConfig
export async function getWifiStatus(): Promise<ExtendedWifiStatus> {
  try {
    const response = await api.getWiFiStatus();
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

export async function repairWifi(): Promise<WifiHealthStatus> {
  try {
    const response = await fetch(`${API_URL}/api/v1/wifi/repair`, {
      method: 'POST'
    });
    const data = await response.json();
    if (!response.ok || 'error' in data) {
      throw new Error(data?.error || 'Error repairing Wi-Fi.');
    }
    return data.health as WifiHealthStatus;
  } catch (error) {
    console.error('Network error while repairing Wi-Fi: ', error.message);
    throw new Error(error.message || 'Network error while repairing Wi-Fi.');
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
        getApiErrorMessage(error, 'Error updating Network Config.')
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
export async function connectToWiFi(
  config: WifiConnectCredentials
): Promise<WifiConnectResult> {
  try {
    const response = await api.connectToWiFi(config as WiFiCredentials);
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as unknown as WifiConnectResult;
  } catch (error) {
    if (error.response) {
      console.error('Error connecting to Wi-Fi: ', error.response.data);
      throw new WiFiConnectionError(
        getApiErrorMessage(error, 'Error connecting to Wi-Fi.'),
        getApiErrorCode(error)
      );
    } else {
      console.error('Network error while connecting to Wi-Fi: ', error.message);
      throw new WiFiConnectionError(
        getApiErrorMessage(error, 'Network error while connecting to Wi-Fi.'),
        getApiErrorCode(error)
      );
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

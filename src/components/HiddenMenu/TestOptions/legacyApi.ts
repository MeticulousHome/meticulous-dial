import { MotorHeaterProfile } from '../TestOptions/TestCommands/motorHeaterPWM';

const API_URL = window.env.SERVER_URL || 'http://localhost:8080';

export const enableLegacyJson = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ allow_legacy_json: true })
    });

    if (!response.ok) {
      throw new Error('Failed to enable legacy JSON');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error enabling legacy JSON:', error);
    throw error;
  }
};

export const getCurrentBrightness = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/machine/backlight`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get current brightness');
    }

    const data = await response.json();
    // Convert device value (0-4095) to percentage (0-100)
    return Math.round((data.brightness * 100) / 4095);
  } catch (error) {
    console.error('Error getting current brightness:', error);
    throw error;
  }
};

export const setLCDBrightnessTesting = async (value: number) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/machine/backlight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        brightness_testing: Math.round((value * 4095) / 100)
      })
    });

    if (!response.ok) {
      throw new Error('Failed to set LCD brightness');
    }
    return true;
  } catch (error) {
    console.error('Error setting LCD brightness:', error);
    throw error;
  }
};

interface RestoreProgress {
  isLoading: boolean;
  message: string;
}

export const sendLegacyJson = async (testJson: MotorHeaterProfile) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/profile/legacy`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testJson)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Send legacy JSON error:', error);
    throw error;
  }
};

export const restoreValues = async (
  onProgress?: (progress: RestoreProgress) => void
) => {
  try {
    onProgress?.({
      isLoading: true,
      message: 'Restoring default values...'
    });

    onProgress?.({
      isLoading: true,
      message: 'Restoring default backlight...'
    });
    await fetch(`${API_URL}/api/v1/machine/backlight`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ brightness: 1 })
    });

    onProgress?.({
      isLoading: true,
      message: 'Enabling WiFi...'
    });
    await fetch(`${API_URL}/api/v1/wifi/radio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enable: true })
    });

    onProgress?.({
      isLoading: true,
      message: 'Setting WiFi to Access Point mode...'
    });
    await fetch(`${API_URL}/api/v1/wifi/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode: 'AP' })
    });

    onProgress?.({
      isLoading: true,
      message: 'Enabling Bluetooth...'
    });
    await fetch(`${API_URL}/api/v1/bluetooth/power`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state: 'on' })
    });

    onProgress?.({
      isLoading: false,
      message: ''
    });

    return true;
  } catch (error) {
    console.error('Error restoring values:', error);
    onProgress?.({
      isLoading: false,
      message: ''
    });
    throw error;
  }
};

export const getWiFiRadioStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/wifi/radio`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get WiFi radio status');
    }

    const data = await response.json();
    return data.enabled;
  } catch (error) {
    console.error('Error getting WiFi radio status:', error);
    throw error;
  }
};

export const setWiFiRadioStatus = async (enable: boolean) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/wifi/radio`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ enable })
    });

    if (!response.ok) {
      throw new Error('Failed to set WiFi radio status');
    }

    const data = await response.json();
    if (data.status === 'error') {
      throw new Error(data.error);
    }

    return data.enabled;
  } catch (error) {
    console.error('Error setting WiFi radio status:', error);
    throw error;
  }
};

export const getWiFiMode = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/wifi/config`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get WiFi mode');
    }

    const data = await response.json();
    // Convert mode to uppercase
    return data.config.mode.toUpperCase() as 'AP' | 'CLIENT';
  } catch (error) {
    console.error('Error getting WiFi mode:', error);
    throw error;
  }
};

export const setWiFiMode = async (mode: 'AP' | 'CLIENT') => {
  console.log('mode', mode);
  try {
    const response = await fetch(`${API_URL}/api/v1/wifi/config`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ mode })
    });

    if (!response.ok) {
      throw new Error('Failed to set WiFi mode');
    }

    const data = await response.json();
    return data.config.mode;
  } catch (error) {
    console.error('Error setting WiFi mode:', error);
    throw error;
  }
};

export const getBluetoothStatus = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/bluetooth/status`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to get Bluetooth status');
    }

    const data = await response.json();
    return data.powered;
  } catch (error) {
    console.error('Error getting Bluetooth status:', error);
    throw error;
  }
};

export const setBluetoothPower = async (enable: boolean) => {
  try {
    const response = await fetch(`${API_URL}/api/v1/bluetooth/power`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ state: enable ? 'on' : 'off' })
    });

    if (!response.ok) {
      throw new Error('Failed to set Bluetooth power state');
    }

    const data = await response.json();
    return data.powered;
  } catch (error) {
    console.error('Error setting Bluetooth power state:', error);
    throw error;
  }
};

export const playSoundTest = async () => {
  try {
    const response = await fetch(`${API_URL}/api/v1/sounds/play/test`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Failed to play test sound');
    }

    return true;
  } catch (error) {
    console.error('Error playing test sound:', error);
    throw error;
  }
};

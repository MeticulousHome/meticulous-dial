import Api, {
  regionType,
  APIError,
  BrightnessRequest,
  DeviceInfo
} from '@meticulous-home/espresso-api';

export const api = new Api(
  undefined,
  window.env?.SERVER_URL || 'http://localhost:8080/'
);

export const startMasterCalibration = async () => {
  try {
    const { data } = await api.executeAction('scale_master_calibration');
    return data;
  } catch (error) {
    console.error('Start profile error: ', error.message);
  }
};

export const getOSStatus = async () => {
  try {
    const { data } = await api.getOSStatus();
    return data;
  } catch (error) {
    console.error('Failed to fetch OS status:', error);
    throw error;
  }
};

export async function getDeviceInfo(): Promise<DeviceInfo> {
  try {
    const response = await api.getDeviceInfo();
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as DeviceInfo;
  } catch (error) {
    if (error.response) {
      console.error('Error fetching device Info: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error fetching device Info'
      );
    } else {
      console.error(
        'Network error while fetching device Info: ',
        error.message
      );
      throw new Error('Network error while fetching device Info.');
    }
  }
}

export const setBrightness = async ({ brightness }: BrightnessRequest) => {
  try {
    await api.setBrightness({ brightness });
  } catch (error) {
    console.error('Error setting brightness', error);
  }
};

export const getTimezoneRegion = async (
  region_type: regionType,
  filter: string
) => {
  try {
    const { data } = await api.getTimezoneRegion(region_type, filter);
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
  } catch (error) {
    console.error('Error getting timezones', error);
    throw new Error(error);
  }
};

export const setTimezone = async (new_timezone: string) => {
  try {
    const { data } = await api.updateSetting({ time_zone: new_timezone });
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
  } catch (error) {
    console.error('Error setting timezone', error);
    throw new Error(error);
  }
};

export const setTimezoneSync = async (new_timezonesync: string) => {
  try {
    const { data } = await api.updateSetting({
      timezone_sync: new_timezonesync
    });
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
  } catch (error) {
    console.error('Error setting timezone sync', error);
    throw new Error(error);
  }
};

// The API package doesn't expose this endpoint
export const factoryReset = async () => {
  try {
    const server = window.env?.SERVER_URL || 'http://localhost:8080/';
    const url = server + `/api/v1/machine/factory_reset?confirm=true`;

    const response = await fetch(url, { method: 'GET' });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if ('error' in data) {
      throw new Error((data as APIError).error);
    }
    return data;
  } catch (error) {
    console.error('Error factory resetting', error);
    throw new Error(error);
  }
};

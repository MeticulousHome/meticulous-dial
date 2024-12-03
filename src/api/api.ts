import Api, {
  BrightnessRequest,
  APIError,
  regionType
} from '@meticulous-home/espresso-api';

export const api = new Api(
  undefined,
  window.env.SERVER_URL || 'http://localhost:8080/'
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
    return data;
  } catch (error) {
    console.error('Error getting timezones', error);
  }
};

export const setTimezone = async (new_timezone: string) => {
  try {
    const { data } = await api.updateSetting({ time_zone: new_timezone });
    return data;
  } catch (error) {
    console.error('Error setting timezone', error);
  }
};

export const setTimezoneSync = async (new_timezonesync: string) => {
  try {
    const { data } = await api.updateSetting({
      timezone_sync: new_timezonesync
    });
    return data;
  } catch (error) {
    console.error('Error setting timezone sync', error);
  }
};

export const isAPIError = (value: any): value is APIError => {
  return (value as APIError).error !== undefined;
};

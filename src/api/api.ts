import Api, { BrightnessRequest } from '@meticulous-home/espresso-api';

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

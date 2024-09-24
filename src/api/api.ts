import Api from '@meticulous-home/espresso-api';

export const api = new Api(
  undefined,
  process.env.SERVER_URL || 'http://localhost:8080/'
);

export const startMasterCalibration = async () => {
  try {
    const { data } = await api.executeAction('scale_master_calibration');
    return data;
  } catch (error) {
    console.error('Start profile error: ', error.message);
  }
};

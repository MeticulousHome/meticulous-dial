import { APIError, Settings } from '@meticulous-home/espresso-api';
import { api } from './api';

export async function getSettings(): Promise<Settings> {
  try {
    const response = await api.getSettings();
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as Settings;
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

export async function updateSettings(
  update: Partial<Settings>
): Promise<Settings> {
  try {
    const response = await api.updateSetting(update);
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as Settings;
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

export async function setTime(dateTime: Date): Promise<Settings> {
  try {
    const response = await api.setTime(dateTime);
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as Settings;
  } catch (error) {
    if (error.response) {
      console.error('Error setting time ', error.response.data);
      throw new Error(error.response.data?.message || 'Error setting time');
    } else {
      console.error('Network error while setting time: ', error.message);
      throw new Error('Network error while setting time');
    }
  }
}

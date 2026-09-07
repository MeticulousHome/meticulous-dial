import { APIError, Settings } from '@meticulous-home/espresso-api';
import { DialSettings } from '../types';
import { api } from './api';

export async function getSettings(): Promise<DialSettings> {
  try {
    const response = await api.getSettings();
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as DialSettings;
  } catch (error) {
    if (error.response) {
      console.error('Error getting Settings: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error getting Settings.'
      );
    } else {
      console.error('Network error while getting Settings: ', error.message);
      throw new Error('Network error while getting Settings.');
    }
  }
}

export async function updateSettings(
  update: Partial<DialSettings>
): Promise<DialSettings> {
  try {
    const response = await api.updateSetting(update as Partial<Settings>);
    const data = response.data;
    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }
    return data as DialSettings;
  } catch (error) {
    if (error.response) {
      console.error('Error updating settings: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error updating settings.'
      );
    } else {
      console.error('Network error while updating settings:', error.message);
      throw new Error('Network error while updating settings.');
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

export async function getRootPassword(): Promise<string> {
  try {
    const response = await api.getRootPassword();
    const data = response.data;

    if (data && 'error' in data) {
      throw new Error((data as APIError).error);
    }

    if (data && 'status' in data && 'root_password' in data) {
      if (data.status === 'success' && data.root_password) {
        return data.root_password;
      }
    }

    throw new Error('Invalid response format');
  } catch (error) {
    if (error.response) {
      console.error('Error getting root password: ', error.response.data);
      throw new Error(
        error.response.data?.message || 'Error getting root password.'
      );
    } else {
      console.error(
        'Network error while getting root password: ',
        error.message
      );
      throw new Error('Network error while getting root password.');
    }
  }
}

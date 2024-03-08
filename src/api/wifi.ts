import { IpcMainEvent } from 'electron';
import axios from 'axios';
import { NetworkConfig, PasswortConnect } from '../types';

export const backendURL = process.env.SERVER_URL || 'http://localhost:8080';

const axiosInstance = axios.create({
  baseURL: backendURL
});

export const getNetworkConfig = async () => {
  try {
    const response = await axiosInstance.get('/wifi/config');
    return response.data;
  } catch (error) {
    console.error('getNetworkConfig error ', error);
  }
};

export const getWifiList = async () => {
  try {
    const response = await axiosInstance.get('/wifi/list');
    return response.data;
  } catch (error) {
    console.error('getWifiList error ', error);
  }
};

export const connectToWifi = async (
  _event: IpcMainEvent,
  config: PasswortConnect
) => {
  try {
    const payload = {
      ssid: config.ssid,
      password: config.password
    };
    const response = await axiosInstance.post('/wifi/connect', payload);
    console.log('Log ~ connect to wifi ~ response:', response);
    return response.data;
  } catch (error) {
    console.error('connectToWifi error ', error);
  }
};

export const updateNetworkConfig = async (
  _event: IpcMainEvent,
  newConfig: Partial<NetworkConfig>
) => {
  try {
    const response = await axiosInstance.post('/wifi/config', newConfig);
    console.log('Log ~ updateNetworkConfig ~ response:', response);
    return response.data;
  } catch (error) {
    console.error('getNetworkConfig error ', error);
  }
};

export const notificationFeedback = async (id: string, response: string) => {
  try {
    const notification = await axiosInstance.post('/notifications', {
      id,
      response
    });
    return notification;
  } catch (error) {
    console.log('notification feedback error', id);
  }
};

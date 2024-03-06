import { IpcMainEvent } from 'electron';
import axios from 'axios';
import { NetworkConfig } from '../types';

const axiosInstance = axios.create({
  baseURL: process.env.SERVER_URL || 'http://localhost:8080'
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

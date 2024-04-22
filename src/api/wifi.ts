import { IpcMainEvent } from 'electron';
import axios from 'axios';
import { NetworkConfig, PasswortConnect } from '../types';
import Api, {
  AcknowledgeNotificationRequest,
  WiFiConfig,
  WiFiConnectRequest
} from 'meticulous-api';

const api = new Api();

export const getNetworkConfig = async () => {
  try {
    const response = await api.getWiFiConfig();
    return response.data;
  } catch (error) {
    console.error('getNetworkConfig error ', error);
  }
};

export const getWifiList = async () => {
  try {
    const response = await api.listAvailableWiFi();
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
    const payload: WiFiConnectRequest = {
      ssid: config.ssid,
      password: config.password
    };
    const response = await api.connectToWiFi(payload);
    console.log('Log ~ connect to wifi ~ response:', response);
    return response.data;
  } catch (error) {
    console.error('connectToWifi error ', error);
  }
};

export const updateNetworkConfig = async (
  _event: IpcMainEvent,
  newConfig: Partial<WiFiConfig>
) => {
  try {
    const response = await api.setWiFiConfig(newConfig);
    console.log('Log ~ updateNetworkConfig ~ response:', response);
    return response.data;
  } catch (error) {
    console.error('getNetworkConfig error ', error);
  }
};

export const notificationFeedback = async (id: string, response: string) => {
  try {
    const notification_response: AcknowledgeNotificationRequest = {
      id,
      response
    };
    const notification = await api.acknowledgeNotification(
      notification_response
    );
    return notification;
  } catch (error) {
    console.log('notification feedback error', id);
  }
};

export const deleteKnowWifi = async (
  _event: IpcMainEvent,
  { ssid }: { ssid: string }
) => {
  try {
    const response = await api.deleteWifi({ ssid });
    return response.data;
  } catch (error) {
    console.log('deleteKnowWifi error: ', error);
  }
};

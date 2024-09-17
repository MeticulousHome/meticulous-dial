import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import { WiFiConfig, WiFiConnectRequest } from 'meticulous-api';
import {
  connectToWiFi,
  deleteKnownWifi,
  getNetworkConfig,
  listAvailableWiFi,
  updateNetworkConfig
} from '../api/wifi';

export const LIST_WIFI_QUERY_KEY = 'availableWifiList';
export const NETWORK_CONFIG_QUERY_KEY = 'networkConfig';

// Hook to fetch network config
export const useNetworkConfig = () => {
  return useQuery({
    queryKey: [NETWORK_CONFIG_QUERY_KEY],
    queryFn: getNetworkConfig,
    staleTime: 0,
    refetchInterval: 2000
  });
};

// Hook to update network config
export const useUpdateNetworkConfig = () => {
  return useMutation({
    mutationFn: (data: Partial<WiFiConfig>) => updateNetworkConfig(data),
    onError: (error) => {
      console.error('Error updating Network Config:', error);
    },
    onSuccess: () => {
      console.log('Network Config updated successfully.');
    }
  });
};

// Hook to fetch available Wi-Fi list
export const useAvailableWiFiList = () => {
  return useQuery({
    queryKey: [LIST_WIFI_QUERY_KEY],
    queryFn: listAvailableWiFi,
    staleTime: Infinity,
    refetchInterval: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
};

// Hook to connect to Wi-Fi
export const useConnectToWiFi = () => {
  return useMutation({
    mutationFn: (data: WiFiConnectRequest) => connectToWiFi(data),
    onError: (error) => {
      console.error('Error connecting to Wi-Fi:', error);
    },
    onSuccess: () => {
      console.log('Connected to Wi-Fi successfully.');
    }
  });
};

// Hook to delete known Wi-Fi
export const useDeleteKnownWiFi = (queryClient: QueryClient) => {
  return useMutation({
    mutationFn: (ssid: string) => deleteKnownWifi(ssid),
    onError: (error) => {
      console.error('Error deleting known Wi-Fi:', error);
    },
    onSuccess: () => {
      console.log('Known Wi-Fi deleted successfully.');
      queryClient.invalidateQueries({ queryKey: [NETWORK_CONFIG_QUERY_KEY] });
    }
  });
};

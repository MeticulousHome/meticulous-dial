import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import { WiFiConfig } from '@meticulous-home/espresso-api';
import {
  connectToWiFi,
  deleteKnownWifi,
  getWifiStatus,
  listAvailableWiFi,
  repairWifi,
  WifiConnectCredentials,
  updateNetworkConfig
} from '../api/wifi';

export const LIST_WIFI_QUERY_KEY = 'availableWifiList';
export const NETWORK_CONFIG_QUERY_KEY = 'networkConfig';

const DEFAULT_NETWORK_REFETCH_INTERVAL = 2000;
const IDLE_NETWORK_REFETCH_INTERVAL = 60000;

// Hook to fetch network config
export const useNetworkConfig = (options?: { idle?: boolean }) => {
  return useQuery({
    queryKey: [NETWORK_CONFIG_QUERY_KEY],
    queryFn: getWifiStatus,
    staleTime: 0,
    refetchInterval: options?.idle
      ? IDLE_NETWORK_REFETCH_INTERVAL
      : DEFAULT_NETWORK_REFETCH_INTERVAL
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

export const useRepairWiFi = (queryClient?: QueryClient) => {
  return useMutation({
    mutationFn: repairWifi,
    onError: (error) => {
      console.error('Error repairing Wi-Fi:', error);
    },
    onSuccess: () => {
      console.log('Wi-Fi repair completed successfully.');
      queryClient?.invalidateQueries({ queryKey: [NETWORK_CONFIG_QUERY_KEY] });
    }
  });
};

// Hook to fetch available Wi-Fi list
export const useAvailableWiFiList = () => {
  return useQuery({
    queryKey: [LIST_WIFI_QUERY_KEY],
    queryFn: listAvailableWiFi,
    staleTime: 0,
    refetchInterval: false,
    refetchOnMount: 'always',
    refetchOnReconnect: false,
    refetchOnWindowFocus: false
  });
};

// Hook to connect to Wi-Fi
export const useConnectToWiFi = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: WifiConnectCredentials) => connectToWiFi(data),
    onError: (error) => {
      console.error('Error connecting to Wi-Fi:', error);
    },
    onSuccess: () => {
      console.log('Connected to Wi-Fi successfully.');
      queryClient.invalidateQueries({ queryKey: [NETWORK_CONFIG_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [LIST_WIFI_QUERY_KEY] });
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

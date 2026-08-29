import { QueryClient, useMutation, useQuery } from '@tanstack/react-query';

import { listPairedDevices, revokePairedDevice } from '../api/pairing';

export const PAIRED_DEVICES_QUERY_KEY = 'pairedDevices';

const PAIRED_DEVICES_REFETCH_INTERVAL = 5000;

// Hook to fetch the machine's paired devices
export const usePairedDevices = () => {
  return useQuery({
    queryKey: [PAIRED_DEVICES_QUERY_KEY],
    queryFn: listPairedDevices,
    staleTime: 2000,
    refetchInterval: PAIRED_DEVICES_REFETCH_INTERVAL
  });
};

// Hook to revoke a paired device's token
export const useRevokePairedDevice = (queryClient: QueryClient) => {
  return useMutation({
    mutationFn: (deviceId: string) => revokePairedDevice(deviceId),
    onError: (error) => {
      console.error('Error revoking paired device:', error);
    },
    onSuccess: () => {
      console.log('Paired device revoked successfully.');
      queryClient.invalidateQueries({ queryKey: [PAIRED_DEVICES_QUERY_KEY] });
    }
  });
};

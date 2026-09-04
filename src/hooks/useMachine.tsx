import { QueryClient, useMutation } from '@tanstack/react-query';
import { factoryReset, rotateMachineIdentity } from '../api/api';
import { DEVICE_INFO_QUERY_KEY } from './useDeviceOSStatus';
import { PAIRED_DEVICES_QUERY_KEY } from './usePairedDevices';

export const useFactoryReset = () => {
  return useMutation({
    mutationFn: factoryReset,
    onError: (error) => {
      console.error('Error during factory reset', error);
    },
    onSuccess: () => {
      console.log('Factory Reset successfull.');
    }
  });
};

export const useRotateMachineIdentity = (queryClient: QueryClient) => {
  return useMutation({
    mutationFn: rotateMachineIdentity,
    onError: (error) => {
      console.error('Error resetting machine identity', error);
    },
    onSuccess: () => {
      console.log('Machine identity reset successfully.');
      queryClient.invalidateQueries({ queryKey: [DEVICE_INFO_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PAIRED_DEVICES_QUERY_KEY] });
    }
  });
};

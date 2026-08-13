import { useMutation } from '@tanstack/react-query';
import { checkForUpdates, factoryReset } from '../api/api';

export const useUpdateCheck = () => {
  return useMutation({
    mutationFn: checkForUpdates
  });
};

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

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  getSettings,
  setTime,
  updateSettings,
  getRootPassword
} from '../api/settings';

const USER_SETTINGS_QUERY_KEY = 'user-settings';
const ROOT_PASSWORD_QUERY_KEY = 'root-password';

// Hook to fetch user Settings
export const useSettings = () => {
  return useQuery({
    queryKey: [USER_SETTINGS_QUERY_KEY],
    queryFn: getSettings,
    staleTime: 0,
    refetchInterval: 2000
  });
};

// Hook to update user Settings
export const useUpdateSettings = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateSettings,
    onError: (error) => {
      console.error('Error updating User Settings:', error);
    },
    onSuccess: (data) => {
      console.log('User Settings updated successfully.');
      queryClient.setQueryData([USER_SETTINGS_QUERY_KEY], data);
    }
  });
};

// Hook to set the system time
export const useSetTime = () => {
  return useMutation({
    mutationFn: setTime,
    onError: (error) => {
      console.error('Error updating User Settings:', error);
    }
  });
};

// Hook to get the root password
export const useRootPassword = () => {
  return useQuery({
    queryKey: [ROOT_PASSWORD_QUERY_KEY],
    queryFn: getRootPassword,
    staleTime: 60000 // La contraseña no cambia con frecuencia
  });
};

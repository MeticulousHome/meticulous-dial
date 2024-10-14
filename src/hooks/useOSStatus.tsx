import { useQuery } from '@tanstack/react-query';
import { getOSStatus } from '../api/api';
import { OSStatusResponse } from '@meticulous-home/espresso-api';

export const OS_UPDATE_STATUS = 'os_update_status';

export const initialOSStatus: OSStatusResponse = {
  progress: 0,
  status: 'IDLE',
  info: ''
};

// Hook to fetch network config
export const useOSStatus = () => {
  return useQuery({
    queryKey: [OS_UPDATE_STATUS],
    queryFn: getOSStatus,
    initialData: initialOSStatus,
    staleTime: 0,
    refetchInterval: 2000
  });
};

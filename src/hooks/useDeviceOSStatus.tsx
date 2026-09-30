import { OSStatusResponse } from '@meticulous-home/espresso-api';
import { useQuery } from '@tanstack/react-query';
import { getDeviceInfo, getOSStatus } from '../api/api';

export const OS_UPDATE_STATUS = 'os_update_status';
export const DEVICE_INFO_QUERY_KEY = 'device_info';

export const initialOSStatus: OSStatusResponse = {
  progress: 0,
  status: 'IDLE',
  info: ''
};

export const useOSStatus = () => {
  return useQuery({
    queryKey: [OS_UPDATE_STATUS],
    queryFn: getOSStatus,
    initialData: initialOSStatus,
    staleTime: 0,
    refetchInterval: 60000
  });
};

export const useDeviceInfo = (options?: { refetchInterval?: number }) => {
  return useQuery({
    queryKey: [DEVICE_INFO_QUERY_KEY],
    queryFn: () => getDeviceInfo(),
    staleTime: 0,
    refetchInterval: options?.refetchInterval ?? 2 * 60 * 60 * 1000 // Every 2 hours
  });
};

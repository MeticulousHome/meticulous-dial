import { useQuery } from '@tanstack/react-query';
import { api } from '../api/api';
import { HistoryQueryParams } from '@meticulous-home/espresso-api';

export const QUERY_KEY_HISTORY_LAST_SHOT = 'history_last_shot';
export const QUERY_KEY_HISTORY = 'history';

export const useLastShot = () => {
  return useQuery({
    queryKey: [QUERY_KEY_HISTORY_LAST_SHOT],
    queryFn: () => api.getLastShot().then((res) => res.data),
    staleTime: 0,
    refetchInterval: 10000
  });
};

export function useMachineShotHistory(query: Partial<HistoryQueryParams>) {
  return useQuery({
    queryKey: [QUERY_KEY_HISTORY, query],
    queryFn: () => api.searchHistory(query)
  });
}

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/api';
import { HistoryQueryParams } from '@meticulous-home/espresso-api';
import { Profile } from '@meticulous-home/espresso-profile';

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

export function lastShotForProfileQuery(profile: Profile) {
  if (!profile) {
    return null;
  }
  const query: Partial<HistoryQueryParams> = {
    ids: [profile.id],
    dump_data: true,
    max_results: 1
  };
  return query;
}

export function useHistoryShot(query: Partial<HistoryQueryParams>) {
  return useQuery({
    queryKey: [QUERY_KEY_HISTORY, query],
    queryFn: () => api.searchHistory(query).then((res) => res.data),
    enabled: query != null
  });
}

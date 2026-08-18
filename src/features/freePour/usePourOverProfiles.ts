import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getInstalledPourOverProfiles,
  POUR_OVER_PROFILES_QUERY_KEY
} from './profileApi';

export const usePourOverProfiles = () =>
  useQuery({
    queryKey: [POUR_OVER_PROFILES_QUERY_KEY],
    queryFn: getInstalledPourOverProfiles,
    placeholderData: keepPreviousData,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });

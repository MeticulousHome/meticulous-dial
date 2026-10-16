import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient
} from '@tanstack/react-query';

import {
  deleteInstalledPourOverProfile,
  getInstalledPourOverProfiles,
  POUR_OVER_PROFILES_QUERY_KEY
} from './profileApi';
import { PourOverProfile } from './types';
import { removePourOverProfileFromCatalog } from '../../components/ProfileHomeScreen/homeSelection';

export const usePourOverProfiles = () =>
  useQuery({
    queryKey: [POUR_OVER_PROFILES_QUERY_KEY],
    queryFn: getInstalledPourOverProfiles,
    placeholderData: keepPreviousData,
    gcTime: Infinity,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });

export const useDeletePourOverProfile = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteInstalledPourOverProfile,
    onMutate: async (profileId) => {
      await queryClient.cancelQueries({
        queryKey: [POUR_OVER_PROFILES_QUERY_KEY]
      });
      const previousProfiles = queryClient.getQueryData<PourOverProfile[]>([
        POUR_OVER_PROFILES_QUERY_KEY
      ]);
      queryClient.setQueryData<PourOverProfile[]>(
        [POUR_OVER_PROFILES_QUERY_KEY],
        (profiles = []) => removePourOverProfileFromCatalog(profiles, profileId)
      );
      return { previousProfiles };
    },
    onError: (error, _profileId, context) => {
      if (context?.previousProfiles) {
        queryClient.setQueryData(
          [POUR_OVER_PROFILES_QUERY_KEY],
          context.previousProfiles
        );
      }
      console.error('Error deleting Pour Over profile:', error);
    },
    onSettled: () =>
      queryClient.invalidateQueries({
        queryKey: [POUR_OVER_PROFILES_QUERY_KEY]
      })
  });
};

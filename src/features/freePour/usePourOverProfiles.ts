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
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [POUR_OVER_PROFILES_QUERY_KEY]
      }),
    onError: (error) => {
      console.error('Error deleting Pour Over profile:', error);
    }
  });
};

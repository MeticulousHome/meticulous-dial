import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSoundVolume, setSoundVolume } from '../api/api';

const SOUND_VOLUME_QUERY_KEY = 'soundVolume';

// Hook to fetch sound volume
export const useSoundVolume = () => {
  return useQuery({
    queryKey: [SOUND_VOLUME_QUERY_KEY],
    queryFn: getSoundVolume,
    staleTime: 5000,
    retry: false
  });
};

// Hook to update sound volume
export const useUpdateSoundVolume = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setSoundVolume,
    onError: (error) => {
      console.error('Error setting sound volume:', error);
      // On error, refetch to get the actual value
      queryClient.invalidateQueries({ queryKey: [SOUND_VOLUME_QUERY_KEY] });
    },
    onSuccess: (_, volume) => {
      // Optimistically update the cache
      queryClient.setQueryData([SOUND_VOLUME_QUERY_KEY], volume);
      // Invalidate to ensure we have the latest value
      queryClient.invalidateQueries({ queryKey: [SOUND_VOLUME_QUERY_KEY] });
    }
  });
};

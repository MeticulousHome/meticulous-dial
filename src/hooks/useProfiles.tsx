import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query';

import {
  deleteProfile,
  getDefaultProfileImages,
  getDefaultProfiles,
  getLastProfile,
  getProfiles,
  saveProfile
} from '../api/profile';
import { invoke } from '@tauri-apps/api/core';

import { Profile } from '@meticulous-home/espresso-profile';
import { useState } from 'react';

export const PROFILES_QUERY_KEY = 'profiles';
export const LASTS_PROFILE_QUERY_KEY = 'last_profile';
export const DEFAULT_PROFILES_QUERY_KEY = 'default_profiles';
export const LAST_PROFILE_QUERY_KEY = 'lastProfile';
export const DEFAULT_PROFILE_IMAGES_QUERY_KEY = 'default_profile_images';

export const useProfiles = () => {
  const [prefetchedProfiles, setPrefetchedProfiles] = useState<
    Profile[] | undefined
  >(undefined);
  const fetch_profiles = async () => {
    try {
      const profiles = await getProfiles();
      setPrefetchedProfiles(profiles);
      return profiles;
    } catch (error) {
      console.error('Error fetching profiles:', error);
      if (!!prefetchedProfiles) {
        return prefetchedProfiles;
      }
      if (!('__TAURI_INTERNALS__' in window)) {
        throw error;
      }
      throw new Error('Failed to fetch profiles');
      // FIXME reenable the prefetching here later once we have the images available
      const profiles = await invoke('get_profiles');
      setPrefetchedProfiles(profiles as Profile[]);
      return profiles as Profile[];
    }
  };

  return useQuery({
    queryKey: [PROFILES_QUERY_KEY],
    queryFn: fetch_profiles,
    placeholderData: keepPreviousData,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });
};

export const useLastProfile = () => {
  return useQuery({
    queryKey: [LASTS_PROFILE_QUERY_KEY],
    queryFn: getLastProfile,
    placeholderData: keepPreviousData,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });
};

export const useDefaultProfiles = () => {
  return useQuery({
    queryKey: [DEFAULT_PROFILES_QUERY_KEY],
    queryFn: getDefaultProfiles,
    placeholderData: keepPreviousData,
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });
};

export const useProfileDefaultImages = () => {
  return useQuery({
    queryKey: [DEFAULT_PROFILE_IMAGES_QUERY_KEY],
    queryFn: getDefaultProfileImages,
    placeholderData: [],
    refetchOnReconnect: 'always',
    refetchOnWindowFocus: false
  });
};

export const useDeletePreset = () => {
  return useMutation({
    mutationFn: deleteProfile,
    onSuccess: () => {
      console.log('Profile deleted successfully.');
    },
    onError: (error) => {
      console.error('Error deleting profile:', error);
    }
  });
};

export const useSavePreset = () => {
  return useMutation({
    mutationFn: async ({ profile }: { profile: Profile }) => {
      return await saveProfile(profile);
    },
    onSuccess: () => {
      console.log('Profile added successfully.');
    },
    onError: (error) => {
      console.error('Error adding profile:', error);
    }
  });
};

import { keepPreviousData, useQuery } from '@tanstack/react-query';

import {
  getDefaultProfiles,
  getProfilesForReactQueryy as getProfilesForReactQuery
} from '../api/profile';

import { addVariablesToSettings } from '../utils/preset';

import { Profile } from '@meticulous-home/espresso-profile';

export const PROFILES_QUERY_KEY = 'profiles';
const DEFAULT_PROFILES_QUERY_KEY = 'default';
export const LAST_PROFILE_QUERY_KEY = 'lastProfile';

/**
 * Receives a `profile` and returns it with the `settings[]` property added. The content of this property is adjusted according to the variables that the profile contains.
 * @param {Profile} profile - Profile to which you will add the settings.
 * @returns {ProfileValue} profile modified with the `settings[]` property added.
 */
const addSettingsToProfile = (profile: Profile) => ({
  ...profile,
  settings: [
    {
      id: 1,
      type: 'text',
      key: 'name',
      label: 'name',
      value: profile.name,
      isInternal: true
    },
    {
      id: 2,
      type: 'numerical',
      key: 'temperature',
      label: 'temperature',
      value: profile.temperature || 85,
      unit: '°c',
      isInternal: true
    },
    {
      id: 3,
      type: 'numerical',
      key: 'output',
      label: 'output',
      value: profile.final_weight || 36,
      unit: 'g',
      isInternal: true
    },
    {
      id: 4,
      type: 'image',
      key: 'image',
      label: 'Select image',
      value: profile.display.image.replace('/api/v1/profile/image/', ''),
      isInternal: true
    },
    ...addVariablesToSettings({
      variables: profile.variables,
      nextId: 5
    })
  ]
});

export const useProfiles = () => {
  return useQuery({
    queryKey: [PROFILES_QUERY_KEY],
    queryFn: getProfilesForReactQuery,
    placeholderData: keepPreviousData,
    select: (data: Profile[]) => data.map(addSettingsToProfile),
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

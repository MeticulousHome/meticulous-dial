import { useQueries, keepPreviousData } from '@tanstack/react-query';
import equal from 'fast-deep-equal';

import { getProfiles, getLastProfile } from '../api/profile';

import { addVariablesToSettings } from '../utils/preset';

import { Profile } from '@meticulous-home/espresso-profile';
import { LastProfileIdent } from '@meticulous-home/espresso-api';
import { useEffect, useMemo } from 'react';
import { useSocket } from '../components/store/SocketManager';
import { useAppDispatch } from '../components/store/hooks';
import {
  ProfileValue,
  setActiveIndexSwiper,
  setActivePreset,
  setAllSettings,
  setDefaultPresetIndex,
  setProfiles,
  setStatus,
  setUpdatingSettings
} from '../components/store/features/preset/preset-slice';
import { settingsDefaultNewPreset } from '../utils/mock';

export const PROFILES_QUERY_KEY = 'profiles';
export const LAST_PROFILE_QUERY_KEY = 'lastProfile';

/**
 * Receives a `profile` and returns it with the `settings[]` property added. The content of this property is adjusted according to the variables that the profile contains.
 * @param {Profile} profile - Profile to which you will add the settings.
 * @returns {ProfileValue} profile modified with the `settings[]` property added.
 */
const addSettingsToProfile = (profile: Profile): ProfileValue => ({
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

/**
 * Return an object with the properties `isLoading`, `isError`, `isFetching`, `isPending`, and `profiles`.
 * The array `profiles` contains the profiles and the last brewed profile combined into a single array.
 * If the last brewed profile hasn’t been deleted, it is marked in the profiles list. If it was deleted,
 * then it is marked and added to the end of the resulting list.
 * @param none
 * @returns {Object} an object that contains information about the state of the queries, the unified profiles list, the index of the last profile, and a flag indicating whether it is known or not.
 */
export function usePressets(): {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  profiles: ProfileValue[];
  lastProfileIndex: number;
  isLastProfileKnown: boolean;
} {
  return useQueries({
    queries: [
      {
        queryKey: [PROFILES_QUERY_KEY],
        queryFn: getProfiles,
        placeholderData: keepPreviousData,
        select: (data: Profile[]) => data.map(addSettingsToProfile),
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false
      },
      {
        queryKey: [LAST_PROFILE_QUERY_KEY],
        queryFn: getLastProfile,
        placeholderData: keepPreviousData,
        select: (data: LastProfileIdent) => ({
          ...data,
          profile: addSettingsToProfile(data.profile)
        }),
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false
      }
    ],
    combine: (results) => {
      const [profilesResult, lastProfileResult] = results;

      const profiles = profilesResult?.data || [];
      const lastProfileBrewed = lastProfileResult?.data?.profile;
      const {
        combinedProfiles,
        lastProfilePotentialIndex,
        isLastProfileKnown
      } = useMemo(() => {
        const lastProfilePotentialIndex = profiles.findIndex(
          (profile) => profile.id === lastProfileBrewed.id
        );

        const isLastProfileKnown =
          lastProfilePotentialIndex >= 0 &&
          equal(profiles[lastProfilePotentialIndex], lastProfileBrewed);

        const combinedProfiles = isLastProfileKnown
          ? profiles.map((profile, index) =>
              index === lastProfilePotentialIndex
                ? { ...profile, isLast: true }
                : profile
            )
          : [...profiles, { ...lastProfileBrewed, isLast: true }];

        return {
          combinedProfiles,
          lastProfilePotentialIndex,
          isLastProfileKnown
        };
      }, [profiles, lastProfileBrewed]);

      return {
        isLoading: profilesResult.isLoading || lastProfileResult.isLoading,
        isError: profilesResult.isError || lastProfileResult.isError,
        isFetching: profilesResult.isFetching || lastProfileResult.isFetching,
        isPending: profilesResult.isPending || lastProfileResult.isPending,
        profiles: combinedProfiles,
        lastProfileIndex: lastProfilePotentialIndex,
        isLastProfileKnown
      };
    }
  });
}

export function useProfileManagement() {
  const dispatch = useAppDispatch();
  //const { profileChangeData } = useSocket();

  const { profiles, lastProfileIndex, isLastProfileKnown, isError } =
    usePressets();
  console.log('Pressets::usePressets::profiles ---->', profiles);

  useEffect(() => {
    if (!isError) {
      dispatch(setStatus('failed'));
      return;
    }

    if (profiles) {
      const allSettings = profiles.map((profile) => ({
        presetId: profile.id.toString(),
        settings: profile.settings
      }));

      const { settings } = allSettings.find(
        (item) => item.presetId === profiles[lastProfileIndex].id.toString()
      );

      const updatingSettings = {
        presetId: profiles[lastProfileIndex].id.toString(),
        settings: settings || [...settingsDefaultNewPreset]
      };

      dispatch(setStatus('ready'));
      dispatch(setProfiles(profiles));
      dispatch(setAllSettings(allSettings));
      dispatch(setDefaultPresetIndex(lastProfileIndex));
      dispatch(setActivePreset(profiles[lastProfileIndex]));
      dispatch(setUpdatingSettings(updatingSettings));
      dispatch(setActiveIndexSwiper(lastProfileIndex));
    }
  }, [profiles, dispatch]);
}

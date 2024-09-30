import { useQueries, keepPreviousData } from '@tanstack/react-query';
import equal from 'fast-deep-equal';

import { getProfiles, getLastProfile } from '../api/profile';

import { addVariablesToSettings } from '../utils/preset';

import { Profile } from '@meticulous-home/espresso-profile';
import { LastProfileIdent } from '@meticulous-home/espresso-api';
import { useMemo } from 'react';

export const PROFILES_QUERY_KEY = 'profiles';
export const LAST_PROFILE_QUERY_KEY = 'lastProfile';

/**
 * Return an object with the properties `isLoading`, `isError`, `isFetching`, `isPending`, and `profiles`.
 * The array `profiles` contains the profiles and the last brewed profile combined into a single array.
 * If the last brewed profile hasn’t been deleted, it is marked in the profiles list. If it was deleted,
 * then it is marked and added to the end of the resulting list.
 * @params none
 */
export function usePressets(): {
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;
  isPending: boolean;
  profiles: Profile[];
} {
  return useQueries({
    queries: [
      {
        queryKey: [PROFILES_QUERY_KEY],
        queryFn: getProfiles,
        placeholderData: keepPreviousData,
        select: (data: Profile[]) =>
          data.map((profile) => ({
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
                value: profile.display.image.replace(
                  '/api/v1/profile/image/',
                  ''
                ),
                isInternal: true
              },
              ...addVariablesToSettings({
                variables: profile.variables,
                nextId: 5
              })
            ]
          })),
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false
      },
      {
        queryKey: [LAST_PROFILE_QUERY_KEY],
        queryFn: getLastProfile,
        placeholderData: keepPreviousData,
        select: (data: LastProfileIdent) => ({
          ...data,
          profile: {
            ...data.profile,
            settings: [
              {
                id: 1,
                type: 'text',
                key: 'name',
                label: 'name',
                value: data.profile.name,
                isInternal: true
              },
              {
                id: 2,
                type: 'numerical',
                key: 'temperature',
                label: 'temperature',
                value: data.profile.temperature || 85,
                unit: '°c',
                isInternal: true
              },
              {
                id: 3,
                type: 'numerical',
                key: 'output',
                label: 'output',
                value: data.profile.final_weight || 36,
                unit: 'g',
                isInternal: true
              },
              {
                id: 4,
                type: 'image',
                key: 'image',
                label: 'Select image',
                value: data.profile.display.image.replace(
                  '/api/v1/profile/image/',
                  ''
                ),
                isInternal: true
              },
              ...addVariablesToSettings({
                variables: data.profile.variables,
                nextId: 5
              })
            ]
          }
        }),
        refetchOnReconnect: 'always',
        refetchOnWindowFocus: false
      }
    ],
    combine: (results) => {
      const [profilesResult, lastProfileResult] = results;

      const profiles = profilesResult?.data || [];
      const lastProfileBrewed = lastProfileResult?.data?.profile;

      const lastProfilePotentialIndex = profiles.findIndex(
        (profile) => profile.id === lastProfileBrewed.id
      );

      const isLastProfileKnown =
        lastProfilePotentialIndex >= 0 &&
        equal(profiles[lastProfilePotentialIndex], lastProfileBrewed);

      // Aquí usas useMemo para calcular combinedProfiles solo cuando las dependencias cambian
      const combinedProfiles = useMemo(() => {
        return isLastProfileKnown
          ? profiles.map((profile, index) =>
              index === lastProfilePotentialIndex
                ? { ...profile, isLast: true }
                : profile
            )
          : [...profiles, { ...lastProfileBrewed, isLast: true }];
      }, [
        profiles,
        lastProfileBrewed,
        lastProfilePotentialIndex,
        isLastProfileKnown
      ]);

      return {
        isLoading: profilesResult.isLoading || lastProfileResult.isLoading,
        isError: profilesResult.isError || lastProfileResult.isError,
        isFetching: profilesResult.isFetching || lastProfileResult.isFetching,
        isPending: profilesResult.isPending || lastProfileResult.isPending,
        profiles: combinedProfiles
      };
    }
  });
}

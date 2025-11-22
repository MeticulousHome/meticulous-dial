import { useEffect } from 'react';
import { useAppDispatch } from '../components/store/hooks';
import { loadNotifications } from '../components/store/features/notifications/notification-slice';
import {
  useDefaultProfiles,
  useProfileDefaultImages,
  useProfiles
} from './useProfiles';
import { api, API_URL } from '../api/api';

export function useFetchData(onReady?: () => void) {
  const dispatch = useAppDispatch();
  const {
    data: profiles,
    isError: profilesError,
    refetch: profilesRefetch
  } = useProfiles();

  const { data: defaultProfiles } = useDefaultProfiles();
  const { data: defaultImages } = useProfileDefaultImages();

  useEffect(() => {
    if (!defaultImages || defaultImages.length == 0) {
      return;
    }
    defaultImages.forEach((picture) => {
      const img = new Image();
      img.src = picture;
    });
  }, [defaultImages]);

  useEffect(() => {
    if (!defaultProfiles) {
      return;
    }
    defaultProfiles.community.forEach((profile) => {
      const img = new Image();
      img.src =
        profile.display?.image &&
        `${API_URL}${api.getProfileImageUrl(profile.display.image)}`;
    });
    defaultProfiles.default.forEach((profile) => {
      const img = new Image();
      img.src =
        profile.display?.image &&
        `${API_URL}${api.getProfileImageUrl(profile.display.image)}`;
    });
  }, [defaultImages]);

  useEffect(() => {
    dispatch(loadNotifications());
  }, []);

  useEffect(() => {
    if (profilesError) {
      setTimeout(() => {
        profilesRefetch();
        dispatch(loadNotifications());
      }, 1000);
    }
  }, [profilesError]);

  useEffect(() => {
    if (profiles && !profilesError) {
      profiles.forEach((profile) => {
        const img = new Image();
        img.src =
          profile.display?.image &&
          `${API_URL}${api.getProfileImageUrl(profile.display.image)}`;
      });
      console.log('calling onReady');
      if (onReady) {
        onReady();
      }
    }
  }, [profiles, profilesError]);
}

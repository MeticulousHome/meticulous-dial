import { useEffect } from 'react';
import { useAppDispatch } from '../components/store/hooks';
import { loadNotifications } from '../components/store/features/notifications/notification-slice';
import { useProfiles } from './useProfiles';

export function useFetchData(onReady?: () => void) {
  const dispatch = useAppDispatch();
  const {
    data: profiles,
    isError: profilesError,
    refetch: profilesRefetch
  } = useProfiles();

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
      console.log('calling onReady');
      if (onReady) {
        onReady();
      }
    }
  }, [profiles, profilesError]);
}

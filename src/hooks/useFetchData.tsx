import { useEffect, useRef } from 'react';
import { useAppDispatch } from '../components/store/hooks';
import { loadNotifications } from '../components/store/features/notifications/notification-slice';
import { useProfiles } from './useProfiles';

export function useFetchData(onReady?: () => void) {
  const dispatch = useAppDispatch();
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onReadyCalledRef = useRef(false);
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
      retryTimeoutRef.current = setTimeout(() => {
        profilesRefetch();
        dispatch(loadNotifications());
      }, 1000);
    }
    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [profilesError]);

  useEffect(() => {
    if (profiles && !profilesError && !onReadyCalledRef.current) {
      console.log('calling onReady');
      if (onReady) {
        onReadyCalledRef.current = true;
        onReady();
      }
    }
  }, [profiles, profilesError]);
}

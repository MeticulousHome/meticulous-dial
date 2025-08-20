import { useEffect, useState } from 'react';
import { useSocket } from '../components/store/SocketManager';
import { PROFILES_QUERY_KEY, useProfiles } from './useProfiles';
import { useSettings } from './useSettings';
import { useQueryClient } from '@tanstack/react-query';

export const useIsOnline = () => {
  const socket = useSocket();
  const settings = useSettings();
  const profiles = useProfiles();
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    // If we were online before we are okay with brief socket disconnects
    // FIXME: use a timestamp or a timeout here to detect a crashing backend
    // FIXME: Merge useFetchData and this hook
    setIsOnline((prev) => {
      const online =
        (prev || socket.connected) && !!settings.data && !!profiles.data;
      if (online !== prev) {
        queryClient.invalidateQueries({ queryKey: [PROFILES_QUERY_KEY] });
      }
      return online;
    });
  }, [socket.connected, !!settings.data, !!profiles.data]);

  return isOnline;
};

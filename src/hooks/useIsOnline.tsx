import { useEffect, useState } from 'react';
import { useSocket } from '../components/store/SocketManager';
import { useProfiles } from './useProfiles';
import { useSettings } from './useSettings';

export const useIsOnline = () => {
  const socket = useSocket();
  const settings = useSettings();
  const profiles = useProfiles();
  const [isOnline, setIsOnline] = useState<boolean>(false);

  useEffect(() => {
    // If we were online before we are okay with brief socket disconnects
    // FIXME: use a timestamp or a timeout here to detect a crashing backend
    // FIXME: Merge useFetchData and this hook
    setIsOnline(
      (prev) => (prev || socket.connected) && !!settings.data && !!profiles.data
    );
  }, [socket.connected, !!settings.data, !!profiles.data]);

  return isOnline;
};

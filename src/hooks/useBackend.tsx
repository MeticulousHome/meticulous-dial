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
    setIsOnline(socket.connected && !!settings.data && !!profiles.data);
  }, [socket.connected, !!settings.data, !!profiles.data]);

  return isOnline;
};

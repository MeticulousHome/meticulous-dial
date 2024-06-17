import { useCallback } from 'react';
import { useAppSelector } from '../../src/components/store/hooks';

export const useNotConnectedMessage = () => {
  const wifi = useAppSelector((state) => state.wifi);

  const getMessageIfIsConnected = useCallback(
    ({ messageValue }: { messageValue: string | null | undefined }) => {
      if ((!wifi.wifiStatus || !wifi.wifiStatus.connected) && !messageValue) {
        return 'Not Connected';
      }

      return { messageValue };
    },
    [!wifi.wifiStatus]
  );

  return {
    getMessageIfIsConnected
  };
};

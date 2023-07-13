import { useContext, useEffect } from 'react';
import { SocketContext } from '../components/store/SocketManager';
import { getPresets } from '../components/store/features/preset/preset-slice';

export function useFetchData() {
  const dispatch = useContext(SocketContext);

  useEffect(() => {
    dispatch(getPresets());
  }, []);
}

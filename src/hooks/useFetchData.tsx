import { useContext, useEffect } from 'react';
import { SocketContext } from '../components/store/SocketManager';
import { getPresets } from '../components/store/features/extraReducer';

export function useFetchData() {
  const dispatch = useContext(SocketContext);

  useEffect(() => {
    dispatch(getPresets());
  }, []);

  // useEffect(() => {
  //   if (presets.initAt) {
  //     setPresetsData(presets.value);
  //   }
  // }, [presets.value, presets.initAt]);
}

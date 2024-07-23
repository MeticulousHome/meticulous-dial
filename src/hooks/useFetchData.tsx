import { useEffect } from 'react';
import { getPresets } from '../components/store/features/preset/preset-slice';
import { getConfig as getWifiConfig } from '../components/store/features/wifi/wifi-slice';
import { useAppDispatch, useAppSelector } from '../components/store/hooks';

export function useFetchData() {
  const dispatch = useAppDispatch();
  const presetsState = useAppSelector((state) => state.presets.status);

  useEffect(() => {
    dispatch(getPresets({}));
    dispatch(getWifiConfig());
  }, []);

  useEffect(() => {
    if (presetsState === 'failed') {
      setTimeout(() => {
        dispatch(getPresets({}));
      }, 1000);
    }
  }, [presetsState]);
}

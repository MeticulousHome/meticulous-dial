import { useContext, useEffect } from 'react';
import { useAppSelector } from '../components/store/hooks';
import { SocketContext } from '../components/store/SocketManager';
import { getPresets } from '../components/store/features/extraReducer';
import { setSettings } from '../components/store/features/preset/preset-slice';
import { setPresetsData } from '../data/presets';

export function useFetchData() {
  const dispatch = useContext(SocketContext);
  const { presets } = useAppSelector((state) => state);

  useEffect(() => {
    dispatch(getPresets());
  }, []);

  useEffect(() => {
    if (presets.activePreset.id !== -1 && presets.allSettings.length) {
      dispatch(setSettings(presets.activePreset.id));
    }
  }, [presets.activePreset, presets.allSettings]);

  useEffect(() => {
    if (presets.initAt) {
      setPresetsData(presets.value);
    }
  }, [presets.value, presets.initAt]);
}

import { useContext, useEffect } from 'react';
import {
  getPresetSettings,
  getPresets,
  setSettings
} from '../components/store/features/preset/preset-slice';
import { useAppSelector } from '../components/store/hooks';
import { SocketContext } from '../components/store/SocketManager';

export function useFetchData() {
  const dispatch = useContext(SocketContext);
  const { presets, presetSetting } = useAppSelector((state) => state);

  useEffect(() => {
    dispatch(getPresets());
    dispatch(getPresetSettings());
  }, []);

  useEffect(() => {
    if (presets.activePreset.id !== -1 && presets.allSettings.length) {
      dispatch(setSettings(presets.activePreset.id));
    }
  }, [presets.activePreset, presetSetting.allSettings]);
}

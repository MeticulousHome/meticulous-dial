import { useContext, useEffect } from 'react';
import {
  getPresets,
  setSettings
} from '../components/store/features/preset/preset-slice';
import { getPresetSettings } from '../components/store/features/presetSetting/presetSetting-slice';
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
    if (presets.activePreset.id !== -1 && presetSetting.allSettings.length) {
      dispatch(setSettings(presets.activePreset.id));
    }
  }, [presets.activePreset, presetSetting.allSettings]);
}

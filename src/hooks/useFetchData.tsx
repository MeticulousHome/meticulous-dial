import { useContext, useEffect } from 'react';
import {
  getPresets,
  setSettings
} from '../components/store/features/preset/preset-slice';
import { getPresetSettings } from '../components/store/features/presetSetting/presetSetting-slice';
import { useAppSelector } from '../components/store/hooks';
import { SockerContext } from '../components/store/SockerManager';

export function useFetchData() {
  const dispatch = useContext(SockerContext);
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

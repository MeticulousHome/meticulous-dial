import { useContext, useEffect } from 'react';
import { setActivePreset } from '../components/store/features/preset/preset-slice';
import { setSettings } from '../components/store/features/presetSetting/presetSetting-slice';
import { useAppSelector } from '../components/store/hooks';
import { SockerContext } from '../components/store/SockerManager';
import { getPresetSettingsData } from '../data/presetSettings';

export function useFetchData() {
  const dispatch = useContext(SockerContext);
  const { presets } = useAppSelector((state) => state);

  useEffect(() => {
    if (
      Array.isArray(presets.value) &&
      presets.value.length &&
      presets.activePreset.id === -1
    ) {
      let defaultPresetIndex = presets.value.findIndex(
        (preset) => preset.isDefault === true
      );
      defaultPresetIndex = defaultPresetIndex === -1 ? 0 : defaultPresetIndex;
      setActivePreset(defaultPresetIndex);
    }
  }, [presets]);

  useEffect(() => {
    if (presets.activePresetIndex > -1) {
      const listSettings = getPresetSettingsData;
      const settings = listSettings.find(
        (presetSetting) =>
          parseInt(presetSetting.presetId) === presets.activePreset.id
      );
      dispatch(setSettings(settings));
    }
  }, [presets.activePresetIndex]);
}

import { useContext, useEffect } from 'react';
import { SockerContext } from '../components/store/SockerManager';
import { useAppSelector } from '../components/store/hooks';
import { setActivePreset } from '../components/store/features/preset/preset-slice';

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
}

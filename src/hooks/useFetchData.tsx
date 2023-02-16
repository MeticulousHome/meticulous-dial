import { useContext, useEffect } from 'react';
import { fetchPreset } from '../components/store/features/preset/preset-slice';
import { SockerContext } from '../components/store/SockerManager';
import { fetchPresetSetting } from '../components/store/features/presetSetting/presetSetting-slice';

export function useFetchData() {
  const dispatch = useContext(SockerContext);

  useEffect(() => {
    dispatch(fetchPreset());
    dispatch(fetchPresetSetting('Filter 2.1'));
  }, []);

  // useEffect(() => {
  //   if (presets.activePreset) {
  //     dispatch(fetchPresetSetting(presets.activePreset.name));
  //   }
  // }, [presets.activePreset]);
}

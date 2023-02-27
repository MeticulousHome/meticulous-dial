import { useContext, useEffect } from 'react';
import { fetchPreset } from '../components/store/features/preset/preset-slice';
import { SockerContext } from '../components/store/SockerManager';
import { fetchPresetSetting } from '../components/store/features/presetSetting/presetSetting-slice';
import { useAppSelector } from '../components/store/hooks';

export function useFetchData() {
  const dispatch = useContext(SockerContext);
  const { presets } = useAppSelector((state) => state);

  useEffect(() => {
    dispatch(fetchPreset());
  }, []);

  useEffect(() => {
    dispatch(fetchPresetSetting(presets.activePreset.name));
  }, [presets.activePreset.name]);

  // useEffect(() => {
  //   if (presets.activePreset) {
  //     dispatch(fetchPresetSetting(presets.activePreset.name));
  //   }
  // }, [presets.activePreset]);
}

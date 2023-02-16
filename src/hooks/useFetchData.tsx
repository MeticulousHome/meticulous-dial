import { useContext, useEffect } from 'react';
import { fetchPreset } from '../components/store/features/preset/preset-slice';
import { SockerContext } from '../components/store/SockerManager';
import { useAppSelector } from '../components/store/hooks';
import { setStats } from '../components/store/features/stats/stats-slice';
import { setEndIndex } from '../components/store/features/presetSetting/presetSetting-slice';

export function useFetchData() {
  const dispatch = useContext(SockerContext);
  const { presets } = useAppSelector((state) => state);
  const { activePreset } = presets;

  useEffect(() => {
    dispatch(fetchPreset());
  }, []);

  useEffect(() => {
    if (presets.activePreset) {
      dispatch(
        setStats({
          name: presets.activePreset.stage,
          time: presets.activePreset.time,
          sensors: presets.activePreset.sensors
        })
      );
    }
  }, [presets.activePreset]);

  useEffect(() => {
    if (activePreset?.sensors) {
      dispatch(
        setEndIndex(
          Object.keys(activePreset.sensors).length > 0
            ? Object.keys(activePreset.sensors).length + 4 //presset setting: 2 dummy items in setting, 1 for ok button, 1 for discard button
            : 0
        )
      );
    } else {
      dispatch(setEndIndex(0));
    }
  }, [presets.activePresetIndex]);
}

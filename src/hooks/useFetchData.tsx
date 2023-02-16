import { useContext, useEffect } from 'react';
import { fetchPreset } from '../components/store/features/preset/preset-slice';
import { SockerContext } from '../components/store/SockerManager';
import { useAppSelector } from '../components/store/hooks';
import { setStats } from '../components/store/features/stats/stats-slice';

export function useFetchData() {
  const dispatch = useContext(SockerContext);
  const { presets } = useAppSelector((state) => state);

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
}

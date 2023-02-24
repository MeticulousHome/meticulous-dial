import { useContext, useEffect } from 'react';
import { fetchPreset } from '../components/store/features/preset/preset-slice';
import { SockerContext } from '../components/store/SockerManager';
import { fetchPresetSetting } from '../components/store/features/presetSetting/presetSetting-slice';
// import { setStats } from '../components/store/features/stats/stats-slice';

export function useFetchData() {
  const dispatch = useContext(SockerContext);

  useEffect(() => {
    dispatch(fetchPreset());
    dispatch(fetchPresetSetting('Filter 2.1'));
    // setTimeout(() => {
    //   dispatch(
    //     setStats({
    //       profile: 'Mock Stats',
    //       name: 'initialize',
    //       sensors: {
    //         p: '60',
    //         t: '20',
    //         w: '200',
    //         f: '100'
    //       },
    //       time: '200'
    //     })
    //   );
    // }, 3000);
    // setTimeout(() => {
    //   dispatch(
    //     setStats({
    //       profile: 'Mock Stats',
    //       name: 'idle',
    //       sensors: {
    //         p: '60',
    //         t: '20',
    //         w: '200',
    //         f: '100'
    //       },
    //       time: '200'
    //     })
    //   );
    // }, 6000);
  }, []);

  // useEffect(() => {
  //   if (presets.activePreset) {
  //     dispatch(fetchPresetSetting(presets.activePreset.name));
  //   }
  // }, [presets.activePreset]);
}

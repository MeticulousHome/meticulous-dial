import { useContext, useEffect } from 'react';
import { SockerContext } from '../components/store/SockerManager';
import { getPresets } from '../components/store/features/extraReducer';

export function useFetchData() {
  const dispatch = useContext(SockerContext);

  useEffect(() => {
    dispatch(getPresets());
  }, []);

  // useEffect(() => {
  //   if (presets.initAt) {
  //     setPresetsData(presets.value);
  //   }
  // }, [presets.value, presets.initAt]);
}

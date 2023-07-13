import { useContext, useEffect } from 'react';
import { SockerContext } from '../components/store/SockerManager';
import { getPresets } from '../components/store/features/preset/preset-slice';

export function useFetchData() {
  const dispatch = useContext(SockerContext);

  useEffect(() => {
    dispatch(getPresets());
  }, []);
}

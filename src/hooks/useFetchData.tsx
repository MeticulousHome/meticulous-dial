import { useEffect } from 'react';
import { getPresets } from '../components/store/features/preset/preset-slice';
import { useAppDispatch } from '../components/store/hooks';

export function useFetchData() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    dispatch(getPresets());
  }, []);
}

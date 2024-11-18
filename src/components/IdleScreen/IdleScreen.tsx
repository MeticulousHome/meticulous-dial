import { useEffect } from 'react';

import { setBrightness } from '../../api/api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { AnalogClock } from './AnalogClock';

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);

  useEffect(() => {
    setBrightness({ brightness: 0 });

    return () => {
      setBrightness({ brightness: 1 });
    };
  }, []);

  useEffect(() => {
    if (shouldGoToIdle || prevScreen === 'idle') return;

    dispatch(setScreen(prevScreen || 'pressets'));
    setBrightness({ brightness: 1 });
  }, [shouldGoToIdle]);

  // FIXME: Use a backend config to select the idle screen
  return <AnalogClock />;
}

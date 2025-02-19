import { useEffect } from 'react';

import { setBrightness } from '../../api/api';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';
import { BaristaClock } from './BaristaClock';
import { DVDIdleScreen } from './DVD';
import { useSettings } from '../../hooks/useSettings';

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const { isIdle: shouldGoToIdle } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings();

  useEffect(() => {
    setBrightness({ brightness: 0 });

    return () => {
      setBrightness({ brightness: 1 });
    };
  }, []);
  useEffect(() => {
    if (shouldGoToIdle || prevScreen === 'idle') return;

    dispatch(setScreen(prevScreen || 'profileHome'));
    setBrightness({ brightness: 1 });
  }, [shouldGoToIdle]);

  switch (globalSettings?.idle_screen) {
    case 'baristaBarista':
      return <BaristaClock />;
    case 'metCat':
      return <DigitalClock useMetCat={true} />;
    case 'digital':
      return <DigitalClock useMetCat={false} />;
    case 'dvd':
      return <DVDIdleScreen />;
    case 'analog':
    case 'default':
    default:
      return <AnalogClock />;
  }
}

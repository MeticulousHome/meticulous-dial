import { useEffect } from 'react';

import { useIdleTimer } from '../../hooks/useIdleTimer';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { AnalogClock } from './AnalogClock';
import { DigitalClock } from './DigitalClock';
import { BaristaClock } from './BaristaClock';
import { DVDIdleScreen } from './DVD';
import { useSettings } from '../../hooks/useSettings';
import { updateBrightness } from '../../hooks/useDimScreen';
import { routes } from '../../navigation/routes';

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    isIdle: shouldGoToIdle,
    forceBubbleReopen,
    setForceBubbleReopen
  } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  useEffect(() => {
    updateBrightness({ brightness: 0 });

    return () => {
      updateBrightness({ brightness: 1 });
      if (forceBubbleReopen) {
        dispatch(
          setBubbleDisplay({
            visible: true,
            component: bubbleDisplay.previousComponent
          })
        );
      }
      setForceBubbleReopen(false);
    };
  }, []);

  useEffect(() => {
    if (shouldGoToIdle || prevScreen === 'idle') return;
    if (!prevScreen || routes[prevScreen].ignoreAsPrevious) {
      dispatch(setScreen('profileHome'));
    }
    if (bubbleDisplay.visible) {
      dispatch(
        setBubbleDisplay({
          visible: false,
          component: bubbleDisplay.previousComponent
        })
      );
    }
    dispatch(setScreen(prevScreen));
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

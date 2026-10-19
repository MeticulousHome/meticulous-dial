import { useEffect, useState } from 'react';

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
import { keyframes, styled } from 'styled-components';

const ScreenOff = styled.div`
  width: 480px;
  height: 480px;
  background: black;
`;

const pixelShift = keyframes`
  0% {
    transform: rotateZ(0deg);
  }
  25% {
      transform: rotateZ(-0.5deg);
  }
  50% {
    transform: rotateZ(0deg);
  }
  75% {
    transform: rotateZ(0.5deg);
  }
  100% {
    transform: rotateZ(0deg);
  }
`;
const ShiftContainer = styled.div`
  animation: ${pixelShift} 3600s infinite;
`;

const selectIdleComponent = (screen: string) => {
  switch (screen) {
    case 'baristaBarista':
      return <BaristaClock />;
    case 'metCat':
      return <DigitalClock key="metcat" useMetCat={true} />;
    case 'digital':
      return <DigitalClock key="digital" useMetCat={false} />;
    case 'dvd':
      return <DVDIdleScreen />;
    case 'analog':
    case 'default':
    default:
      return <AnalogClock />;
  }
};

// 10 minutes
const SCREEN_TIMEOUT = 10 * 60 * 1000;

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    isIdle: shouldGoToIdle,
    screenOffRequested,
    forceBubbleReopen,
    setForceBubbleReopen
  } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings({ idle: true });
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [screenTimedOut, setScreenTimedOut] = useState(false);
  const screenOff = screenOffRequested || screenTimedOut;

  useEffect(() => {
    if (screenOffRequested) return;
    const timeout = setTimeout(() => setScreenTimedOut(true), SCREEN_TIMEOUT);
    return () => clearTimeout(timeout);
  }, [screenOffRequested]);

  useEffect(() => {
    updateBrightness({ brightness: screenOff ? 0 : 0.33 });
  }, [screenOff]);

  useEffect(() => {
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
    updateBrightness({ brightness: 1 });

    if (bubbleDisplay.visible && !bubbleDisplay.pinned) {
      dispatch(
        setBubbleDisplay({
          visible: false,
          component: bubbleDisplay.previousComponent
        })
      );
    }
    if (!prevScreen || routes[prevScreen].ignoreAsPrevious) {
      dispatch(setScreen('profileHome'));
      return;
    }
    dispatch(setScreen(prevScreen));
  }, [shouldGoToIdle]);

  // Stop the clocks' timers and animation frames as well as the backlight.
  // This is a screen mode; the SoM, firmware and network remain running.
  if (screenOff) return <ScreenOff role="img" aria-label="Screen off" />;

  return (
    <ShiftContainer>
      {selectIdleComponent(globalSettings?.idle_screen)}
    </ShiftContainer>
  );
}

import { useEffect, useRef, useState } from 'react';

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

const FadeOverlay = styled.div<{ $hide: boolean }>`
  position: absolute;
  width: 480px;
  height: 480px;
  background: black;
  z-index: 99999;
  opacity: ${({ $hide }) => ($hide ? 0.7 : 0)};

  transition: opacity 1s;
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
    forceBubbleReopen,
    setForceBubbleReopen
  } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const screenDimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [isScreenDim, setIsScreenDim] = useState(false);

  const cycleScreenDim = () => {
    setIsScreenDim((prev) => {
      // Screen is dark, dim up for 5 seconds
      if (prev) {
        screenDimTimeoutRef.current = setTimeout(() => {
          cycleScreenDim();
        }, 5 * 1000);
      } else {
        screenDimTimeoutRef.current = setTimeout(() => {
          cycleScreenDim();
        }, 55 * 1000);
      }
      return !prev;
    });
  };

  useEffect(() => {
    updateBrightness({ brightness: isScreenDim ? 0.03 : 0.33 });
  }, [isScreenDim]);

  useEffect(() => {
    updateBrightness({ brightness: 0.33 });

    // Start a timer to completely disable the screen after a while
    screenDimTimeoutRef.current = setTimeout(() => {
      cycleScreenDim();
    }, SCREEN_TIMEOUT);

    return () => {
      updateBrightness({ brightness: 1 });

      if (screenDimTimeoutRef.current) {
        clearTimeout(screenDimTimeoutRef.current);
      }

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

  return (
    <ShiftContainer>
      <FadeOverlay $hide={isScreenDim} />
      {selectIdleComponent(globalSettings?.idle_screen)}
    </ShiftContainer>
  );
}

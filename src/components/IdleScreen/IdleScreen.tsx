import { useEffect, useRef, useState } from 'react';

import { useIdleTimer } from '../../hooks/useIdleTimer';
import {
  setBubbleDisplay,
  setScreen
} from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { AnalogClock } from './AnalogClock';
import { BaristaClock } from './BaristaClock';
import { DVDIdleScreen } from './DVD';
import { useSettings } from '../../hooks/useSettings';
import { updateBrightness } from '../../hooks/useDimScreen';
import { routes } from '../../navigation/routes';
import { styled } from 'styled-components';
import { PackageIdleScreen } from './runtime/PackageIdleScreen';
import type { IdlePackageId, IdleRuntimePolicy } from './runtime/types';
import {
  burnInStyle,
  useIdleBrightness,
  useIdleClock
} from './runtime/scheduler';

const ShiftContainer = styled.div`
  width: 480px;
  height: 480px;
  transform-origin: 240px 240px;
`;

const selectLegacyIdleComponent = (screen: string) => {
  switch (screen) {
    case 'baristaBarista':
      return <BaristaClock />;
    case 'dvd':
      return <DVDIdleScreen />;
    default:
      return <AnalogClock />;
  }
};

export function IdleScreen(): JSX.Element {
  const dispatch = useAppDispatch();
  const {
    isIdle: shouldGoToIdle,
    forceBubbleReopen,
    setForceBubbleReopen
  } = useIdleTimer();
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const { data: globalSettings } = useSettings({ idle: true });
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const [runtime, setRuntime] = useState<IdleRuntimePolicy | null>(null);
  const now = useIdleClock(null);
  useIdleBrightness(runtime);
  const selectedIdleScreen = useRef<IdlePackageId | null>(null);
  if (selectedIdleScreen.current === null && globalSettings?.idle_screen) {
    selectedIdleScreen.current = normalizeIdleScreenId(
      globalSettings.idle_screen
    );
  }

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

    if (bubbleDisplay.visible) {
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

  return (
    <ShiftContainer style={burnInStyle(runtime, now)}>
      {renderSelectedIdleScreen(selectedIdleScreen.current, now, setRuntime)}
    </ShiftContainer>
  );
}

function normalizeIdleScreenId(screen: string): IdlePackageId {
  if (screen === 'analog') return 'default';
  return screen as IdlePackageId;
}

function renderSelectedIdleScreen(
  selectedId: IdlePackageId | null,
  now: Date,
  setRuntime: (runtime: IdleRuntimePolicy | null) => void
): JSX.Element {
  if (!selectedId) return <AnalogClock />;
  if (selectedId === 'dvd' || selectedId === 'baristaBarista') {
    return selectLegacyIdleComponent(selectedId);
  }
  return (
    <PackageIdleScreen
      selectedId={selectedId}
      now={now}
      onRuntime={setRuntime}
    />
  );
}

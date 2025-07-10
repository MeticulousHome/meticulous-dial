import { styled } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import {
  ModularFooter,
  ModularFooterTime,
  ModularLeft,
  ModularRight,
  ModularScreen
} from '../ModularScreen/ModularScreen';
import { RemoveCupAnimation } from './RemoveCupAnimation';
import { formatTime } from '../../utils';
import { useEffect } from 'react';
import { PurgePiston } from '../PurgePiston/PurgePiston';
import { notificationSelector } from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useContinueBrewAction } from '../store/SocketManager';

const WeightContainer = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: flex-start;
  align-items: flex-start;
  padding-top: 4px;
  padding-bottom: 7px;
  gap: 3px;
`;

const WeightValue = styled.span`
  font-family: 'ABC Diatype Mono';
  font-size: 60px;
  font-weight: normal;
  letter-spacing: -0.02em;
  line-height: 1;
`;

const Unit = styled.sup`
  font-family: 'ABC Diatype';
  font-size: 25px;
  font-weight: normal;
  letter-spacing: -0.01em;
  color: #e7e7e799;
  line-height: 1.2;
`;

const Label = styled.div`
  font-family: 'ABC Diatype';
  font-size: 15px;
  font-weight: 300;
  line-height: 1;
  color: #e7e7e799;
  letter-spacing: 0.2em;
  text-transform: uppercase;
`;

const PurgeEmbedding = styled.div`
  position: relative;
  width: 100%;
  height: 100%;
  right: -20px;
`;

export const BrewCompleteScreen = () => {
  const dispatch = useAppDispatch();
  const continueBrew = useContinueBrewAction();
  const statsName = useAppSelector((state) => state.stats.name);
  const brewTime = useAppSelector((state) => state.stats.time);
  const lastBrewWeight = useAppSelector((state) => state.stats.sensors.w);
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const weight = !isNaN(lastBrewWeight)
    ? Math.abs(lastBrewWeight) < 1000
      ? lastBrewWeight.toFixed(1)
      : lastBrewWeight.toFixed(0)
    : lastBrewWeight;
  const scaleConnected = !isNaN(lastBrewWeight);
  const isPurging = statsName === 'purge';

  useEffect(() => {
    if (statsName === 'idle' && !hasNotifications) {
      dispatch(setScreen('profileHome'));
    }
  }, [statsName]);

  useHandleGestures(
    {
      pressDown() {
        if (statsName === 'click to purge') {
          continueBrew();
        }
      }
    },
    bubbleDisplay.visible
  );

  const stateLabel =
    statsName === 'click to purge'
      ? 'Push to purge'
      : statsName === 'remove cup'
        ? 'Remove cup'
        : '';

  useHandleGestures(
    {
      pressDown() {
        if (!isPurging) {
          continueBrew();
          console.log('action,continue');
        }
      }
    },
    bubbleDisplay.visible
  );

  return (
    <ModularScreen>
      <ModularLeft>
        {isPurging ? (
          <PurgeEmbedding>
            <PurgePiston />
          </PurgeEmbedding>
        ) : (
          <RemoveCupAnimation />
        )}
      </ModularLeft>
      <ModularRight>
        <WeightContainer>
          {scaleConnected ? (
            <>
              <WeightValue>{weight}</WeightValue>
              <Unit>g</Unit>
            </>
          ) : (
            <Label style={{ color: '#f44336' }}>Scale not connected</Label>
          )}
        </WeightContainer>
        <Label>{stateLabel}</Label>
      </ModularRight>
      <ModularFooter style={{ gap: 13 }}>
        <Label>Brew time</Label>
        <ModularFooterTime>{formatTime(brewTime / 1000)}</ModularFooterTime>
      </ModularFooter>
    </ModularScreen>
  );
};

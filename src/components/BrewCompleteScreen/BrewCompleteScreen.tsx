import { styled } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  setScreen,
  setBubbleDisplay
} from '../store/features/screens/screens-slice';
import {
  ModularFooter,
  ModularFooterTime,
  ModularLeft,
  ModularRight,
  ModularScreen
} from '../ModularScreen/ModularScreen';
import { RemoveCupAnimation } from './RemoveCupAnimation';
import { formatTime } from '../../utils';
import { useEffect, useRef, useState } from 'react';
import { MiniPurgePiston } from '../MiniPurgePiston/MiniPurgePiston';
import { notificationSelector } from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useIdleTimer } from '../../hooks/useIdleTimer';
import { useContinueBrewAction } from '../store/SocketManager';
import { ShotGraph } from '../ShotGraph/ShotGraphScreen';
import { useProfileContext } from '../../context/ProfileContext';
import { useBrewDoubleClickHandler } from '../../hooks/useBrewDoubleClickHandler';
import { useManualBrew } from '../../hooks/useManualBrew';

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

export const BrewCompleteScreen = () => {
  const dispatch = useAppDispatch();
  const continueBrew = useContinueBrewAction();
  const statsName = useAppSelector((state) => state.stats.name);
  const brewTime = useAppSelector((state) => state.stats.profile_time);
  const lastBrewWeight = useAppSelector((state) => state.stats.sensors.w);
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  const { localProfile: activeProfile } = useProfileContext();
  const { isManualProfile, activeProfile: manualActiveProfile } =
    useManualBrew();
  const { isIdle: shouldGoToIdle } = useIdleTimer();

  const weight = !isNaN(lastBrewWeight)
    ? Math.abs(lastBrewWeight) < 1000
      ? lastBrewWeight.toFixed(1)
      : lastBrewWeight.toFixed(0)
    : lastBrewWeight;
  const scaleConnected = !isNaN(lastBrewWeight);
  const isPurging = statsName === 'purge';
  const [showPlot, setShowPlot] = useState<boolean>(false);
  const isIdle = statsName === 'idle' || statsName === 'END_STAGE';
  const [keepGraph, setKeepGraph] = useState<boolean>(false);
  const manualGraphReleased = useRef(false);
  const wasManualBrew = useRef(false);

  // A manual brew never runs the selected profile: manual mode is entered from
  // its own setup flow, so the shot that just finished is the last profile the
  // machine loaded, not whatever is selected on the home screen. Graphing the
  // selection would draw the wrong document, or none at all.
  const graphProfile = wasManualBrew.current
    ? manualActiveProfile
    : activeProfile;

  if (!graphProfile) {
    console.error('History was opened without a profile selected');
    dispatch(setScreen('profileHome'));
  }

  // The decision is latched while the screen is mounted, so a later change of
  // the active or last profile cannot release the graph early.
  useEffect(() => {
    if (isManualProfile) {
      wasManualBrew.current = true;
    }
  }, [isManualProfile]);

  // A manual brew holds the graph on its own once the machine is idle, as if
  // the knob had been turned: the quick menu offers to save the brew as a
  // profile from here, and the screen only leaves on a click of the encoder.
  useEffect(() => {
    if (!isIdle || hasNotifications) return;
    if (wasManualBrew.current && !manualGraphReleased.current) {
      setKeepGraph(true);
      return;
    }
    if (!keepGraph) {
      dispatch(setScreen('profileHome'));
    }
  }, [isIdle, keepGraph, hasNotifications]);

  // An unattended machine does not sit on the held graph forever: the
  // app-wide idle timer rests it on the idle screen, as the shot graph does.
  useEffect(() => {
    if (!shouldGoToIdle || !wasManualBrew.current || !keepGraph) return;
    dispatch(setBubbleDisplay({ visible: false, component: undefined }));
    dispatch(setScreen('idle'));
  }, [shouldGoToIdle, keepGraph]);

  // A brew screen, so a double click reaches the machine here too, but only
  // the barometer may finish: this one can only abort.
  const doubleClick = useBrewDoubleClickHandler({ allowFinish: false });

  useHandleGestures(
    {
      doubleClick,
      click() {
        if (statsName === 'click to purge') {
          continueBrew();
        }
        if (isIdle && keepGraph) {
          manualGraphReleased.current = true;
          setKeepGraph(false);
        }
      },
      left() {
        setKeepGraph(true);
      },
      right() {
        setKeepGraph(true);
      }
    },
    bubbleDisplay.interceptsGesture
  );

  const stateLabel =
    statsName === 'click to purge'
      ? 'Push to purge'
      : statsName === 'remove cup'
        ? 'Remove cup'
        : '';

  useEffect(() => {
    if (isPurging) {
      setShowPlot(true);
    }
  }, [isPurging]);
  return (
    <ModularScreen>
      <ModularLeft
        style={{ alignItems: 'flex-start', left: '22px', top: '-18px' }}
      >
        <MiniPurgePiston show={isPurging} />
      </ModularLeft>
      {showPlot ? (
        <ModularRight style={{ left: '0', padding: '0' }}>
          <ShotGraph profile={graphProfile} />
        </ModularRight>
      ) : (
        <>
          <ModularLeft>
            <RemoveCupAnimation />
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
        </>
      )}
    </ModularScreen>
  );
};

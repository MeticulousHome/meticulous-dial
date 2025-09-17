import { CSSProperties, useCallback, useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { SwitchTransition, CSSTransition } from 'react-transition-group';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { Label, Temperature } from './Temperatures';
import './transitions.css';
import {
  ModularFooter,
  ModularFooterText,
  ModularFooterTime,
  ModularLeft,
  ModularRight,
  ModularScreen
} from '../ModularScreen/ModularScreen';
import { formatTime } from '../../utils';
import { BUBBLES_WIDTH, LottieBubbleAnimation } from './LottieBubbleAnimation';
import { notificationSelector } from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { OptionsMenu } from './OptionsMenu';
import { useContinueBrewAction } from '../store/SocketManager';
import { useProfileContext } from '../../context/ProfileContext';
import { loadProfileData, startProfile } from '../../api/profile';

const PushToStartLabel = styled.div`
  font-size: 20px;
  letter-spacing: 4px;
  color: #e7e7e7;
  text-align: center;
  position: absolute;
  width: 100%;
  bottom: 60px;
  text-transform: uppercase;
`;

const StatusLabel = styled.span`
  padding-top: 4px;
  padding-bottom: 8px;
  padding-horizontal: 2px;
  text-transform: uppercase;
  color: #ffffff;
  font-size: 16px;
  letter-spacing: 3px;
  line-height: 120%;
`;

// enum TemperatureErrors
// {
//     TEMP_ERROR_NONE = 0,
//     TEMP_ERROR_OFFLINE = 1000,
//     TEMP_ERROR_NO_SENSORS = 2000,
//     TEMP_ERROR_NAN = 4000,
// };
const SensorErrorLabel = ({ temperature }: { temperature: number }) => {
  // Comparing floats is never precise, so we use a threshold
  if (Math.abs(temperature - 4000) < 1) {
    return <StatusLabel>Temperature calculation failed</StatusLabel>;
  } else if (Math.abs(temperature - 2000) < 1) {
    return <StatusLabel>Waiting for sensor data to become valid</StatusLabel>;
  } else if (Math.abs(temperature - 1000) < 1) {
    return <StatusLabel>All sensors offline. Please restart</StatusLabel>;
  } else {
    return <StatusLabel>Unknown sensor error</StatusLabel>;
  }
};

const transitionDuration = 600;

export const HeatingScreen = () => {
  const dispatch = useAppDispatch();
  const {
    lastProfile,
    mergedProfiles,
    localProfileIndex: activeProfile,
    profileStarting
  } = useProfileContext();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const continueBrew = useContinueBrewAction();
  const waterStatus = useAppSelector((state) => state.stats.waterStatus);
  const prevScreen = useAppSelector((state) => state.screen.prev);
  const temperature =
    useAppSelector((state) => Math.round(state.stats.sensors.t)) || 0;
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );
  const [optionSeletected, setOptionSelected] = useState(null);

  // The stages dont necessarily correctly report the temperature target
  // so we need to cache it with the state below
  const temperatureTargetStatus = useAppSelector(
    (state) => state.stats.setpoints.temperature
  );

  const [temperatureTarget, setTemperatureTarget] = useState(
    temperatureTargetStatus || 0
  );

  // send the profile and start it only when coming from profileHome and
  // the profileStarting flag is set

  useEffect(() => {
    const loadAndStartProfile = async () => {
      const profile = mergedProfiles?.[activeProfile];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isLast, temporary, ...cleanProfile } = profile;
      const data = await loadProfileData(cleanProfile);

      if (data) {
        await startProfile();
      }
    };

    if (prevScreen === 'profileHome' && profileStarting) {
      loadAndStartProfile();
    }
  }, []);

  useEffect(() => {
    if (lastProfile && lastProfile.profile && temperatureTarget == 0) {
      setTemperatureTarget(lastProfile?.profile?.temperature || 0);
    }
  }, [lastProfile]);

  useEffect(() => {
    if (temperatureTargetStatus && temperatureTargetStatus > 0) {
      setTemperatureTarget(temperatureTargetStatus);
    }
  }, [temperatureTargetStatus]);

  const preheatTimeLeft = useCallback(() => {
    if (!waterStatus) {
      return <ModularFooterText>Tap to retry</ModularFooterText>;
    }
    if (!temperatureTargetStatus) {
      return <ModularFooterText>stabilizing...</ModularFooterText>;
    }
    const diff = temperatureTarget - Math.max(20, temperature);

    if (diff <= 2) {
      return <ModularFooterText>a few seconds</ModularFooterText>;
    }
    if (diff <= 5) {
      return <ModularFooterText>less than 30 seconds</ModularFooterText>;
    }

    const stabilizingTime = 20;
    const heatingTime = 200; // in seconds
    const maxDiff = 80; // 100°C - 20°C
    const timePerDegree = heatingTime / maxDiff;
    const timeIncrements = 15; // in seconds
    const timeLeft =
      Math.ceil((diff * timePerDegree + stabilizingTime) / timeIncrements) *
      timeIncrements;
    return <ModularFooterTime>{formatTime(timeLeft)}</ModularFooterTime>;
  }, [temperatureTarget, temperature, temperatureTargetStatus, waterStatus]);

  const statsName = useAppSelector((state) => state.stats.name);
  const heatingFinished = statsName === 'click to start';

  useEffect(() => {
    if (statsName === 'idle' && !hasNotifications && !profileStarting) {
      dispatch(setScreen('profileHome'));
    }
  }, [statsName]);

  // Automatically start the shot based on options menu selected
  useEffect(() => {
    if (!heatingFinished) {
      return;
    }

    // At this point heating has finished and we can descide if we want to auto-start
    if (optionSeletected == 'auto_start') {
      continueBrew();
      console.log('action,continue');
    }
  }, [heatingFinished, optionSeletected]);

  const onOptionChange = (option_key: string) => {
    setOptionSelected(option_key);
  };
  const onOptionHold = (option_key: string) => {
    if (option_key === 'brew_now' && !heatingFinished) {
      continueBrew();
      console.log('action,continue');
    }
  };
  useEffect(() => {
    if (
      !!temperatureTargetStatus &&
      temperatureTargetStatus !== temperatureTarget
    ) {
      setTemperatureTarget(temperatureTargetStatus);
    }
  }, [temperatureTargetStatus]);

  const transitionStyle: CSSProperties = {
    transform: `translateX(${heatingFinished ? 10 + BUBBLES_WIDTH / 2 : 0}px)`,
    transition: `transform ${transitionDuration / 1000}s`
  };

  useHandleGestures(
    {
      click() {
        if (
          heatingFinished &&
          ['push_to_brew', 'brew_now'].includes(optionSeletected)
        ) {
          continueBrew();
          console.log('action,continue');
        }
      }
    },
    bubbleDisplay.interceptsGesture
  );

  return (
    <ModularScreen>
      <ModularLeft style={transitionStyle}>
        <LottieBubbleAnimation
          temperature={temperature}
          waterStatus={waterStatus}
        />
      </ModularLeft>
      <ModularRight style={transitionStyle}>
        <CSSTransition
          in={
            !heatingFinished ||
            (heatingFinished && optionSeletected == 'auto_start')
          }
          unmountOnExit
          timeout={transitionDuration}
          classNames="fade-options"
        >
          <OptionsMenu
            ignoreGestures={heatingFinished}
            onOptionChange={onOptionChange}
            onOptionHold={onOptionHold}
          />
        </CSSTransition>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            marginLeft: 15,
            marginRight: 10,
            justifyContent: 'space-between'
          }}
        >
          <SwitchTransition>
            <CSSTransition
              key={`${waterStatus}`}
              timeout={transitionDuration / 2}
              classNames="fade"
            >
              {waterStatus || heatingFinished ? (
                temperature <= 500 ? (
                  <Temperature value={temperature} animated />
                ) : (
                  <SensorErrorLabel temperature={temperature} />
                )
              ) : (
                <StatusLabel>No water</StatusLabel>
              )}
            </CSSTransition>
          </SwitchTransition>
          <CSSTransition
            in={!heatingFinished}
            unmountOnExit
            timeout={transitionDuration / 2}
            classNames="fade"
          >
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                paddingTop: 4,
                paddingBottom: 7
              }}
            >
              {temperature > 0 && temperature <= 500 && (
                <>
                  <Label>Target</Label>
                  <Temperature value={temperatureTarget} small />
                </>
              )}
            </div>
          </CSSTransition>
        </div>
      </ModularRight>
      <SwitchTransition>
        <CSSTransition
          key={`${heatingFinished}-${waterStatus}`}
          timeout={transitionDuration / 2}
          classNames="fade"
        >
          <ModularFooter style={{ gap: 13 }}>
            {heatingFinished ? (
              <PushToStartLabel>Push to brew</PushToStartLabel>
            ) : (
              <>
                <Label>{waterStatus ? 'Estimated time' : 'Waiting...'}</Label>
                {preheatTimeLeft()}
              </>
            )}
          </ModularFooter>
        </CSSTransition>
      </SwitchTransition>
    </ModularScreen>
  );
};

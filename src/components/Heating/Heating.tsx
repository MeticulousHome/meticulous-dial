import {
  CSSProperties,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useState
} from 'react';
import { styled } from 'styled-components';
import { SwitchTransition, CSSTransition } from 'react-transition-group';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { Label, Temperature } from './Temperatures';
import { BubbleAnimation, BUBBLES_CONTAINER_WIDTH } from './BubbleAnimation';
import './transitions.css';
import {
  ModularFooter,
  ModularLeft,
  ModularRight,
  ModularScreen
} from '../ModularScreen/ModularScreen';
import { formatTime } from '../../utils';

const TimeLeftSeconds = styled.div`
  font-family: 'ABC Diatype Mono';
  font-size: 40px;
  font-weight: 300;
  line-height: 1;
  letter-spacing: -0.02em;
  text-align: center;
`;

const TimeLeftText = styled.div`
  font-family: 'ABC Diatype Mono';
  font-size: 20px;
  font-weight: 300;
  line-height: 1;
  letter-spacing: -0.02em;
  text-align: center;
`;

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
  text-transform: uppercase;
  color: #ffffff;
  font-size: 20px;
  letter-spacing: 3px;
  line-height: 120%;
`;

const transitionDuration = 600;

// const OPTIONS = [
//   {
//     id: 'auto',
//     label: 'Auto brew'
//   },
//   {
//     id: 'manual',
//     label: 'Push to brew'
//   }
// ] as const;

export const Heating = () => {
  const dispatch = useAppDispatch();
  const waterStatus = useAppSelector((state) => state.stats.waterStatus);
  const temperature = useAppSelector((state) =>
    Math.round(state.stats.sensors.t)
  );

  // The stages dont necessarily correctly report the temperature target
  // so we need to cache it with the state below
  const temperatureTargetStatus = useAppSelector(
    (state) => state.stats.setpoints.temperature
  );

  const [temperatureTarget, setTemperatureTarget] = useState(
    temperatureTargetStatus
  );
  const preheatTimeLeft = useCallback(() => {
    if (!temperatureTargetStatus) {
      return <TimeLeftText>stabelizing...</TimeLeftText>;
    }
    const diff = temperatureTarget - Math.max(20, temperature);

    if (diff <= 2) {
      return <TimeLeftText>a few seconds</TimeLeftText>;
    }
    if (diff <= 5) {
      return <TimeLeftText>less than 30 seconds</TimeLeftText>;
    }

    const stabilizingTime = 20;
    const heatingTime = 200; // in seconds
    const maxDiff = 80; // 100°C - 20°C
    const timePerDegree = heatingTime / maxDiff;
    const timeIncrements = 15; // in seconds
    const timeLeft =
      Math.ceil((diff * timePerDegree + stabilizingTime) / timeIncrements) *
      timeIncrements;
    return <TimeLeftSeconds>{formatTime(timeLeft)}</TimeLeftSeconds>;
  }, [temperatureTarget, temperature, temperatureTargetStatus]);

  const statsName = useAppSelector((state) => state.stats.name);
  const heatingFinished = statsName === 'click to start';

  // const { data: globalSettings } = useSettings();
  // const updateSettings = useUpdateSettings();

  useEffect(() => {
    if (statsName === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [statsName]);

  useEffect(() => {
    if (
      !!temperatureTargetStatus &&
      temperatureTargetStatus !== temperatureTarget
    ) {
      setTemperatureTarget(temperatureTargetStatus);
    }
  }, [temperatureTargetStatus]);

  const transitionStyle: CSSProperties = {
    transform: `translateX(${heatingFinished ? 10 + BUBBLES_CONTAINER_WIDTH / 2 : 0}px)`,
    transition: `transform ${transitionDuration / 1000}s`
  };

  return (
    <ModularScreen>
      <ModularLeft style={transitionStyle}>
        <BubbleAnimation temperature={temperature} waterStatus={waterStatus} />
      </ModularLeft>
      <ModularRight style={transitionStyle}>
        {/* <CSSTransition
          in={!heatingFinished}
          unmountOnExit
          timeout={transitionDuration}
          classNames="fade-options"
        >
          <ModularRightOptions
            options={OPTIONS}
            value={globalSettings?.auto_start_shot ? 'auto' : 'manual'}
            onValueChange={(value) => {
              updateSettings.mutate({ auto_start_shot: value === 'auto' });
            }}
          />
        </CSSTransition> */}
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
              {waterStatus ? (
                <Temperature value={temperature} animated />
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
              <Label>Target</Label>
              <Temperature value={temperatureTarget} small />
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
              waterStatus && (
                <>
                  <Label>Estimated time</Label>
                  {preheatTimeLeft()}
                </>
              )
            )}
          </ModularFooter>
        </CSSTransition>
      </SwitchTransition>
    </ModularScreen>
  );
};

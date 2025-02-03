import { CSSProperties, useEffect, useState } from 'react';
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
  ModularRightOptions,
  ModularScreen
} from '../ModularScreen/ModularScreen';
import { formatTime } from '../../utils';

const TimeLeft = styled.div`
  font-family: 'ABC Diatype Mono';
  font-size: 40px;
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

const OPTIONS = [
  {
    id: 'auto',
    label: 'Auto brew'
  },
  {
    id: 'manual',
    label: 'Push to brew'
  }
] as const;

export const Heating = () => {
  const dispatch = useAppDispatch();
  const waterStatus = useAppSelector((state) => state.stats.waterStatus);
  const preheatTimeLeft = useAppSelector(
    (state) => state.stats.preheatTimeLeft
  );
  const temperature = useAppSelector((state) =>
    Math.round(state.stats.sensors.t)
  );

  const temperatureTarget = useAppSelector(
    (state) => state.stats.setpoints.temperature
  );
  const statsName = useAppSelector((state) => state.stats.name);
  const heatingFinished = statsName === 'click to start';
  const [brewTrigger, setBrewTrigger] =
    useState<(typeof OPTIONS)[number]['id']>('auto');

  useEffect(() => {
    if (statsName === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [statsName]);

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
        <CSSTransition
          in={!heatingFinished}
          unmountOnExit
          timeout={transitionDuration}
          classNames="fade-options"
        >
          <ModularRightOptions
            options={OPTIONS}
            value={brewTrigger}
            onValueChange={setBrewTrigger}
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
                  <TimeLeft>{formatTime(preheatTimeLeft)}</TimeLeft>
                </>
              )
            )}
          </ModularFooter>
        </CSSTransition>
      </SwitchTransition>
    </ModularScreen>
  );
};

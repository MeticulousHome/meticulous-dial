import { useEffect } from 'react';
import { styled } from 'styled-components';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { Label, Temperatures } from './Temperatures';
import { BubbleAnimation } from './BubbleAnimation';
import {
  ModularFooter,
  ModularLeft,
  ModularRight,
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

export const Heating = () => {
  const stats = useAppSelector((state) => state.stats);
  const {
    waterStatus,
    preheatTimeLeft,
    setpoints: { temperature: temperatureTarget }
  } = stats;
  const temperature = parseInt(stats.sensors.t);

  const dispatch = useAppDispatch();

  useEffect(() => {
    if (stats.name === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [stats.name]);

  return (
    <ModularScreen>
      <ModularLeft>
        <BubbleAnimation temperature={temperature} waterStatus={waterStatus} />
      </ModularLeft>
      <ModularRight>
        <Temperatures current={temperature} target={temperatureTarget} />
      </ModularRight>
      <ModularFooter style={{ gap: 13 }}>
        <Label>Estimated time</Label>
        <TimeLeft>{formatTime(preheatTimeLeft)}</TimeLeft>
      </ModularFooter>
    </ModularScreen>
  );
};

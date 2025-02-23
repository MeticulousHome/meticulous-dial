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
import { useEffect, useMemo, useRef } from 'react';
import { PurgePiston } from '../PurgePiston/PurgePiston';

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

  const stats = useAppSelector((state) => state.stats);
  const statsName = stats.name;
  const brewTime = stats.time;
  const lastBrewWeight = useRef(stats.sensors.w);

  const weight =
    Math.abs(lastBrewWeight.current) < 1000
      ? lastBrewWeight.current.toFixed(1)
      : lastBrewWeight.current.toFixed(0);
  const isPurging = statsName === 'purge';

  useEffect(() => {
    if (statsName === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [statsName]);

  const stateLabel = useMemo(() => {
    if (statsName === 'click to purge') return 'Push to purge';

    if (statsName === 'remove cup') return 'Remove cup';

    return '';
  }, [statsName]);

  console.log(statsName);
  return (
    <ModularScreen>
      <ModularLeft>
        <RemoveCupAnimation />
      </ModularLeft>
      <ModularRight>
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'start',
            alignItems: 'flex-start',
            paddingTop: 4,
            paddingBottom: 7,
            gap: 3
          }}
        >
          <WeightValue>{weight}</WeightValue>
          <Unit>g</Unit>
        </div>
        <Label>{stateLabel}</Label>
      </ModularRight>
      <ModularFooter style={{ gap: 13 }}>
        <Label>Brew time</Label>
        <ModularFooterTime>{formatTime(brewTime / 1000)}</ModularFooterTime>
      </ModularFooter>
    </ModularScreen>
  );
};

import { useEffect } from 'react';
import './barometer.css';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { Meter } from './Meter';
import { setWaitingForAction } from '../store/features/stats/stats-slice';

export interface IBarometerProps {
  maxValue?: number;
}

export function Barometer({ maxValue = 21 }: IBarometerProps): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (stats.name === 'idle' && !stats.waitingForActionAlreadySent) {
      dispatch(setScreen('pressets'));
    }
  }, [stats.name, stats.waitingForActionAlreadySent]);

  useEffect(() => {
    if (stats.name !== 'idle') {
      dispatch(setWaitingForAction(false));
    }
  }, [stats.name]);

  return (
    <div className="barometer-container">
      <Meter
        min={0}
        max={maxValue}
        step={1}
        value={stats.sensors.p}
        className="meter"
      />
      <div className="bar-needle__content">
        <div className="pressure">Pressure</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(stats.sensors.p, 1)}
          </span>
          <span className="bar-label">bar</span>
        </div>

        <div className="columns-grid">
          <div className="column-item">
            <div className="column-label">Time</div>
            <div className="column-value">
              {formatStatValue(stats.time, 1, 1000)}
              <div className="column-unit">sec</div>
            </div>
          </div>
          <div className="column-item">
            <div className="column-label">Flow</div>
            <div className="column-value">
              {formatStatValue(stats.sensors.f, 1)}
              <div className="column-unit">ml/s</div>
            </div>
          </div>
          <div className="column-item">
            <div className="column-label">Weight</div>
            <div className="column-value">
              {formatStatValue(stats.sensors.w, 1)}
              <div className="column-unit">gr</div>
            </div>
          </div>
          <div className="column-item">
            <div className="column-label">Grav. Flow</div>
            <div className="column-value">
              {formatStatValue(stats.sensors.g, 1)}
              <div className="column-unit">g/s</div>
            </div>
          </div>
        </div>

        <div className="bar-needle__status">{stats.name}</div>
      </div>
    </div>
  );
}

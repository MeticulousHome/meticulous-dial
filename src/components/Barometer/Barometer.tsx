import './barometer.css';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import { useCallback } from 'react';

export interface IBarometerProps {
  stats: IStats;
  maxValue?: number;
}
export interface IStats {
  sensors: { p: string; t: string; w: string; f: string };
  time: string;
  name: string;
}

const getBarNeedlePosition = (pressure: string, maxValue: number) => {
  const final = (313 * parseFloat(pressure)) / maxValue;
  const barNeedleRotatePosition = final < 0 ? 0 : final;

  return barNeedleRotatePosition > 313
    ? 313 + 114
    : barNeedleRotatePosition + 114; //start position
};

export function Barometer({
  stats,
  maxValue = 13
}: IBarometerProps): JSX.Element {
  const barNeedleRotatePosition = getBarNeedlePosition(
    stats.sensors.p,
    maxValue
  );
  const { screen } = useAppSelector((state) => state);

  const getAnimation = useCallback(() => {
    let animation = '';
    if (screen.value === 'barometer') {
      if (screen.prev === 'scale') {
        animation = 'scaleToBarometer__fadeIn';
      }
      if (screen.prev == 'pressetSettings') {
        animation = 'pressetSettingsToBarometer__fadeIn';
      } else {
        animation = 'barometer__fadeIn';
      }
    } else if (screen.value === 'scale' && screen.prev === 'barometer') {
      animation = 'barometerToScale__fadeOut';
    } else if (
      screen.value === 'pressetSettings' &&
      screen.prev === 'barometer'
    ) {
      animation = 'barometerToPressetSettings__fadeOut';
    } else {
      animation = 'barometer__fadeOut';
    }

    return animation;
  }, [screen]);

  return (
    <div className={`barometer-container ${getAnimation()}`}>
      <div
        className="bar-needle bar-needle--transition-all"
        style={{ transform: `rotate(${barNeedleRotatePosition}deg)` }}
      ></div>

      {(screen.prev === 'scale' || screen.value === 'scale') && (
        <div className="main-title-selected">Filter 2.1</div>
      )}

      <div className="bar-needle__content">
        <div className="pressure">PRESSURE</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(stats.sensors.p, 1)}
          </span>
          <span className="bar-label">bar</span>
        </div>

        <div className="columns-grid">
          <div className="column-item">
            <div>
              <div className="column-label">TEMP</div>
              <div className="column-value">
                {formatStatValue(stats.sensors.t, 1)}
              </div>
            </div>
            <div className="column-data">°C</div>
          </div>
          <div className="column-item">
            <div>
              <div className="column-label">WEIGHT</div>
              <div className="column-value">
                {formatStatValue(stats.sensors.w, 1)}
              </div>
            </div>
            <div className="column-data">g</div>
          </div>
          <div className="column-item">
            <div>
              <div className="column-label">TIME</div>
              <div className="column-value">
                {formatStatValue(stats.time, 1)}
              </div>
            </div>
            <div className="column-data">sec</div>
          </div>
          <div className="column-item">
            <div>
              <div className="column-label">FLOW</div>
              <div className="column-value">
                {formatStatValue(stats.sensors.f, 1)}
              </div>
            </div>
            <div className="column-data">ml/s</div>
          </div>
        </div>

        <div className="bar-needle__status">{stats.name}</div>

        <div className="bar-needle__logo">
          <svg
            width="36"
            height="27"
            viewBox="0 0 36 27"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M26.1291 0V26.1291H0V0L13.0646 13.0646L26.1291 0Z"
              fill="white"
            />
            <path
              d="M32.5938 26.4C33.9975 26.4 35.1427 25.2549 35.1427 23.8511C35.1427 22.4474 33.9975 21.3022 32.5938 21.3022C31.1901 21.3022 30.0449 22.4474 30.0449 23.8511C30.0449 25.2549 31.1901 26.4 32.5938 26.4Z"
              fill="white"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

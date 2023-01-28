import { formatStatValue } from '../../utils';
import withBubbleAnimation from '../../HOCs/withBubbleAnimation';
import BarNeedle from './BarNeedle';
import BarometerCircle from './BarometerCircle';

import './barometer.css';
import Logo from './Logo';

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

function Barometer({ stats, maxValue = 13 }: IBarometerProps): JSX.Element {
  const barNeedleRotatePosition = getBarNeedlePosition(
    stats.sensors.p,
    maxValue
  );

  return (
    <div className="barometer-container">
      <BarometerCircle />
      <div className="bar-needle__content">
        <div className="pressure">PRESSURE</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(stats.sensors.p, 1)}
          </span>
          <span className="bar-label">bar</span>
        </div>
        <BarNeedle barNeedleRotatePosition={barNeedleRotatePosition} />

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
        <Logo />
      </div>
    </div>
  );
}

export default withBubbleAnimation(Barometer);

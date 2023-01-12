import './barometer.css';
import { formatStatValue } from '../../utils';

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

  return (
    <div className="barometer-container">
      <div
        className="bar-needle bar-needle--transition-all"
        style={{ transform: `rotate(${barNeedleRotatePosition}deg)` }}
      ></div>
      <div className="bar-needle__content">
        <div className="pressure">PRESSURE</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(stats.sensors.p, 1)}
          </span>
          <span className="text-gray">bar</span>
        </div>
        <div className="bar-needle__column bar-needle__column--mb-16 flex">
          <div className="flex-1">
            <div className="bar-needle__column__label">TEMP</div>
            <span className="bar-needle__column__value">
              {formatStatValue(stats.sensors.t, 1)}
            </span>
            <span className="text-gray">°C</span>
          </div>
          <div>
            <div className="bar-needle__column__label">WEIGHT</div>
            <span className="bar-needle__column__value">
              {formatStatValue(stats.sensors.w, 1)}
            </span>
            <span className="text-gray">g</span>
          </div>
        </div>
        <div className="bar-needle__column bar-needle__column--mb-16 flex">
          <div className="flex-1">
            <div className="bar-needle__column__label">TIME</div>
            <span className="bar-needle__column__value">
              {formatStatValue(stats.time, 1)}
            </span>
            <span className="text-gray">sec</span>
          </div>
          <div>
            <div className="bar-needle__column__label">FLOW</div>
            <span className="bar-needle__column__value">
              {formatStatValue(stats.sensors.f, 1)}
            </span>
            <span className="text-gray">ml/s</span>
          </div>
        </div>
        <div
          className="bar-needle__status"
          style={{ textTransform: 'uppercase' }}
        >
          {stats.name}
        </div>
        <div className="bar-needle__logo">
          <svg viewBox="0 0 618 623" fill="none">
            <path
              d="M615.295 0L341.097 351.495H265.291L78.967 131.473V609.33H0V0.218661L78.967 0.397582L304.755 266.424L506.606 0.218661L615.295 0Z"
              fill="white"
            />
            <path
              d="M533.127 622.611C580.001 622.611 617.999 584.613 617.999 537.739C617.999 490.866 580.001 452.868 533.127 452.868C486.254 452.868 448.256 490.866 448.256 537.739C448.256 584.613 486.254 622.611 533.127 622.611Z"
              fill="#F74537"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

import './barometer.css';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { generateSimplePayload } from '../../utils/preheat';
import { useSocket } from '../store/SocketManager';
import { setScreen } from '../store/features/screens/screens-slice';
import { LCD_EVENTS } from '../../../src/constants';

export interface IBarometerProps {
  maxValue?: number;
}

const getBarNeedlePosition = (pressure: string, maxValue: number) => {
  const final = (313 * parseFloat(pressure)) / maxValue;
  const barNeedleRotatePosition = final < 0 ? 0 : final;

  return barNeedleRotatePosition > 313
    ? 313 + 114
    : barNeedleRotatePosition + 114; //start position
};

export function Barometer({ maxValue = 13 }: IBarometerProps): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const presets = useAppSelector((state) => state.presets);
  const socket = useSocket();
  const dispatch = useAppDispatch();

  useHandleGestures({
    start() {
      const preset = {
        name: presets.activePreset.name,
        settings: (presets.activePreset?.settings || []).filter(
          (item) => item.id !== -1 && item.id !== -2
        )
      };

      const payload = generateSimplePayload({
        presset: preset as any,
        action: 'to_play'
      });

      socket.emit(LCD_EVENTS.ITALIAN_EVENT, payload);

      console.log(LCD_EVENTS.ITALIAN_EVENT, payload);

      // We not need send this event
      // socket.emit(LCD_EVENTS.ACTION_EVENT, LCD_ACTIONS.START_VALUE);
    },
    click() {
      dispatch(setScreen('pressetSettings'));
    },
    left() {
      dispatch(setScreen('pressets'));
    },
    right() {
      dispatch(setScreen('pressets'));
    }
  });

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

import { useEffect } from 'react';

import './barometer.css';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { generateSimplePayload } from '../../utils/preheat';
import { useSocket } from '../store/SocketManager';
import { setScreen } from '../store/features/screens/screens-slice';
import { resetActiveSetting } from '../store/features/preset/preset-slice';
import { Meter } from './Meter';
import { KIND_PROFILE, LCD_EVENT_EMIT } from '../../constants';

export interface IBarometerProps {
  maxValue?: number;
}

export function Barometer({ maxValue = 21 }: IBarometerProps): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const presets = useAppSelector((state) => state.presets);
  const socket = useSocket();
  const dispatch = useAppDispatch();

  useHandleGestures(
    {
      start() {
        switch (presets.activePreset.kind) {
          case 'italian_1_0': {
            const preset = {
              name: presets.activePreset.name,
              settings: (presets.activePreset?.settings || []).filter(
                (item) => item.id !== -1 && item.id !== -2
              )
            };

            if (preset.settings.length === 0) return;

            const payload = generateSimplePayload({
              presset: preset as any,
              action: 'to_play'
            });

            console.log(`${KIND_PROFILE.ITALIAN}:> ${JSON.stringify(payload)}`);

            socket.emit(LCD_EVENT_EMIT.FEED_PROFILE, JSON.stringify(payload));
            break;
          }
          case 'dashboard_1_0': {
            const preset = {
              ...(presets.activePreset as any).dashboard,
              name: presets.activePreset.name,
              source: 'lcd'
            };

            const payload = {
              ...preset,
              action: 'to_play'
            };

            console.log(
              `${KIND_PROFILE.DASHBOARD}:> ${JSON.stringify(payload)}`
            );

            socket.emit(LCD_EVENT_EMIT.FEED_PROFILE, JSON.stringify(payload));
            break;
          }
        }
      },
      click() {
        dispatch(resetActiveSetting());
        dispatch(setScreen('pressetSettings'));
      },
      left() {
        dispatch(setScreen('pressets'));
      },
      right() {
        dispatch(setScreen('pressets'));
      }
    },
    stats?.name !== 'idle' || bubbleDisplay.visible
  );

  useEffect(() => {
    if (stats.name === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [stats.name]);

  return (
    <div className="barometer-container">
      <Meter
        min={0}
        max={maxValue}
        step={1}
        value={Number.parseFloat(stats.sensors.p)}
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
            <div className="column-label">Temp</div>
            <div className="column-value">
              {formatStatValue(stats.sensors.t, 1)}
              <div className="column-unit">°C</div>
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
        </div>

        <div className="bar-needle__status">{stats.name}</div>
      </div>
    </div>
  );
}

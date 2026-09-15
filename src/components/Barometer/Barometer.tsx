import { useEffect } from 'react';
import './barometer.css';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { setScreen } from '../store/features/screens/screens-slice';
import { Meter } from './Meter';
import { setWaitingForAction } from '../store/features/stats/stats-slice';
import { notificationSelector } from '../store/features/notifications/notification-slice';
import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useBrewDoubleClickHandler } from '../../hooks/useBrewDoubleClickHandler';
import { useManualBrew } from '../../hooks/useManualBrew';
import { useContinueBrewAction } from '../store/SocketManager';
import { useManualTarget } from './useManualTarget';
import { toBar } from './manualTarget';

export interface IBarometerProps {
  maxValue?: number;
}

export function Barometer({ maxValue = 21 }: IBarometerProps): JSX.Element {
  const stats = useAppSelector((state) => state.stats);
  const dispatch = useAppDispatch();
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);

  // The only screen that may finish the shot; the retracts that close it are
  // shown here too, and those can only abort.
  const doubleClick = useBrewDoubleClickHandler({ allowFinish: true });
  useHandleGestures({ doubleClick }, bubbleDisplay.interceptsGesture);
  const { isManualBrew, streamedTarget } = useManualBrew();
  const { tenths, trail } = useManualTarget(isManualBrew, streamedTarget);
  const continueBrew = useContinueBrewAction();

  // During a manual brew a single click ends the stage; encoder turns are
  // handled by the machine and come back through the streamed setpoint.
  useHandleGestures(
    { click: () => continueBrew() },
    !isManualBrew || bubbleDisplay.interceptsGesture
  );

  useEffect(() => {
    if (
      stats.name === 'idle' &&
      !stats.waitingForActionAlreadySent &&
      !hasNotifications
    ) {
      dispatch(setScreen('profileHome'));
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
        target={isManualBrew ? { value: toBar(tenths), trail } : undefined}
      />
      <div className="bar-needle__content">
        <div className="pressure">Pressure</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(stats.sensors.p, 1)}
          </span>
          <span className="bar-label">bar</span>
        </div>
        {isManualBrew && (
          <div className="bar-target">
            Target {toBar(tenths).toFixed(1)} bar
          </div>
        )}

        <div className="columns-grid">
          <div className="column-item">
            <div className="column-label">Time</div>
            <div className="column-value">
              {formatStatValue(stats.profile_time, 1, 1000)}
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

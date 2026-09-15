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
import { useManualTarget } from './useManualTarget';
import { toBar } from './manualTarget';
import { MANUAL_TARGET_COLORS } from '../../constants/manualMode.ts';

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
  const { isManualBrew, activeControl, streamedTarget } = useManualBrew();
  const { tenths, trail } = useManualTarget(
    isManualBrew,
    streamedTarget,
    activeControl
  );

  // In the flow stage the whole ring becomes a flow ring: the needle shows the
  // flow sensor, the printed steps read as ml/s and the tick sits at the flow
  // target. In the pressure stage, and in every non-manual brew, it stays the
  // pressure ring. The barometer handles no gestures during a manual brew: the
  // click that switches control and the long press that ends the shot are the
  // machine's own button triggers, so the dial must send nothing on either.
  const flowRing = isManualBrew && activeControl === 'flow';
  const ringValue = flowRing ? stats.sensors.f : stats.sensors.p;
  const ringUnit = flowRing ? 'ml/s' : 'bar';

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
        value={ringValue}
        className="meter"
        target={
          isManualBrew && activeControl
            ? {
                value: toBar(tenths),
                trail,
                color: MANUAL_TARGET_COLORS[activeControl]
              }
            : undefined
        }
      />
      <div className="bar-needle__content">
        <div className="pressure">{flowRing ? 'Flow' : 'Pressure'}</div>
        <div className="bar-needle__legend">
          <span className="bar-needle__value">
            {formatStatValue(ringValue, 1)}
          </span>
          <span className="bar-label">{ringUnit}</span>
        </div>
        {isManualBrew && (
          <div className="bar-target">
            Target {toBar(tenths).toFixed(1)} {ringUnit}
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
          {/* The controlled quantity owns the big readout, so this cell shows
              the other one: pressure while the machine drives flow. */}
          <div className="column-item">
            <div className="column-label">{flowRing ? 'Pressure' : 'Flow'}</div>
            <div className="column-value">
              {formatStatValue(flowRing ? stats.sensors.p : stats.sensors.f, 1)}
              <div className="column-unit">{flowRing ? 'bar' : 'ml/s'}</div>
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

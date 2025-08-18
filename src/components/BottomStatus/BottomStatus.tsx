import { FC } from 'react';
import classNames from 'classnames';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import { notificationSelector } from '../store/features/notifications/notification-slice';
import './bottom-status.css';
import Funnel from './Funnel';
import { useIsOnline } from '../../hooks/useIsOnline';

export const BottomStatus: FC<{ hidden: boolean }> = ({ hidden }) => {
  const stats = useAppSelector((state) => state.stats);
  const scaleConnected = !isNaN(stats.sensors.w);
  const isOnline = useIsOnline();

  const PreheatTimeLeft = useAppSelector(
    (state) => state.stats.preheatTimeLeft
  );

  const motorHot = useAppSelector(notificationSelector.selectMotorHot);

  return (
    <div
      className={classNames('bottom-status', {
        bottom__fadeOut: hidden,
        bottom__fadeIn: !hidden
      })}
    >
      <div
        className="bottom-content"
        style={{ alignItems: `${scaleConnected ? '' : 'center'}` }}
      >
        {isOnline && (
          <div className="bottom-item">
            <div className="status-value">
              {formatStatValue(stats.sensors.t, 1)}
              <div className="status-unit status-temp-icon">°C</div>
            </div>
            {PreheatTimeLeft !== 0 && (
              <div className="funnel-container">
                <Funnel preheatEnabled={PreheatTimeLeft !== 0} />
              </div>
            )}
          </div>
        )}
        <div className="bottom-item">
          {isOnline ? (
            scaleConnected ? (
              <div className="status-value">
                {formatStatValue(stats.sensors.w, 1)}
                <div className="status-unit">gr</div>
              </div>
            ) : (
              <div style={{ fontSize: '24px', color: '#f44336' }}>
                Scale not connected
              </div>
            )
          ) : (
            <div
              style={{
                fontSize: '24px',
                color: '#f44336',
                maxWidth: 300,
                textAlign: 'center'
              }}
            >
              Waiting for the backend to come online
            </div>
          )}
        </div>

        {motorHot ? (
          <div style={{ fontSize: '16px', color: '#f44336' }}>
            Motor temperature too high
          </div>
        ) : null}
      </div>
    </div>
  );
};

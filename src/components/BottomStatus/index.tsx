import React from 'react';
import classNames from 'classnames';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';
import Funnel from './Funnel';

const BottomStatus: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const stats = useAppSelector((state) => state.stats);
  const scaleConnected = !isNaN(stats.sensors.w);
  const PreheatTimeLeft = useAppSelector(
    (state) => state.stats.preheatTimeLeft
  );

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
        <div className="bottom-item">
          {scaleConnected ? (
            <div className="status-value">
              {formatStatValue(stats.sensors.w, 1)}
              <div className="status-unit">gr</div>
            </div>
          ) : (
            <div style={{ fontSize: '24px', color: '#f44336' }}>
              Scale not connected
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BottomStatus;

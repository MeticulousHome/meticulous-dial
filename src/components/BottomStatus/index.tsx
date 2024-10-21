import React from 'react';
import classNames from 'classnames';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';
import Funnel from './Funnel';

const BottomStatus: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const stats = useAppSelector((state) => state.stats);
  const PreheatTimeLeft = useAppSelector(
    (state) => state.settings.PreheatTimeLeft
  );

  return (
    <div
      className={classNames('bottom-status', {
        bottom__fadeOut: hidden,
        bottom__fadeIn: !hidden
      })}
    >
      <div className="bottom-content">
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
          <div className="status-value">
            {formatStatValue(stats.sensors.w, 1)}
            <div className="status-unit">gr</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomStatus;

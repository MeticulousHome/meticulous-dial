import classNames from 'classnames';
import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';

const BottomStatus = ({ hidden }: { hidden: boolean }) => {
  const stats = useAppSelector((state) => state.stats);
  const preheatStatus = useAppSelector((state) => state.settings.preheatStatus);

  return (
    <div
      className={classNames('bottom-status', {
        bottom__fadeOut: hidden,
        bottom__fadeIn: !hidden
      })}
    >
      <div className="bottom-content">
        <div className="bottom-item">
          <div
            className={classNames('status-value', {
              red: preheatStatus === 'enabled',
              disabled: preheatStatus !== 'enabled'
            })}
          >
            {formatStatValue(stats.sensors.t, 1)}
            <div className="status-unit status-temp-icon">°C</div>
          </div>
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

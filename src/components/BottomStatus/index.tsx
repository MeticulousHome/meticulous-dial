import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';

const BottomStatus = ({ hidden }: { hidden: boolean }) => {
  const stats = useAppSelector((state) => state.stats);

  return (
    <div className={`bottom-status bottom__${hidden ? 'fadeOut' : 'fadeIn'}`}>
      <div className="bottom-content">
        <div className="bottom-item">
          <div className="status-value">
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

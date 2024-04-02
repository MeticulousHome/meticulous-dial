import { formatStatValue } from '../../utils';
import { useAppSelector } from '../store/hooks';
import './bottom-status.css';

const BottomStatus = ({ hidden }: { hidden: boolean }) => {
  const stats = useAppSelector((state) => state.stats);
  const { auto_preheat } = useAppSelector((state) => state.settings);

  const renderPreheatValue = () => {
    if (!stats.waterStatus || auto_preheat === 0) {
      return <></>;
    }

    return (
      <>
        <div className="char">{'>'}</div>
        <div className="char" style={{ marginRight: 5 }}>
          {'>'}
        </div>{' '}
        {auto_preheat}
        <div className="status-unit">°C</div>
      </>
    );
  };

  return (
    <div className={`bottom-status bottom__${hidden ? 'fadeOut' : 'fadeIn'}`}>
      <div className="bottom-content">
        <div className="bottom-item">
          <div
            className={`status-value ${
              stats.waterStatus ? 'blue' : 'red'
            } relative`}
          >
            {formatStatValue(stats.sensors.t, 1)}
            <div className="status-unit">°C</div>

            {renderPreheatValue()}
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

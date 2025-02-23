import { useEffect } from 'react';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PurgePiston } from './PurgePiston';

import './piston.css';
import { setScreen } from '../store/features/screens/screens-slice';

export function PurgeScreen(): JSX.Element {
  const dispatch = useAppDispatch();

  const stats = useAppSelector((state) => state.stats);
  const statsName = stats.name;

  useEffect(() => {
    if (statsName === 'idle') {
      dispatch(setScreen('pressets'));
    }
  }, [statsName]);

  return (
    <div className="piston-container">
      <div className="piston-purge-container center">
        <div className="values">
          <div className="value">
            {formatStatValue(stats.sensors.p, 1)}
            <span>bar</span>
          </div>
          <PurgePiston />
          <div className="value">
            {formatStatValue(stats.sensors.f, 1)}
            <span>ml/s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

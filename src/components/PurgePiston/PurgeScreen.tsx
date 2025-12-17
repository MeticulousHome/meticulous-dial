import { useEffect } from 'react';
import { formatStatValue } from '../../utils';
// import { useAppDispatch, useAppSelector } from '../store/hooks';
import { useAppSelector } from '../store/hooks';
import { PurgePiston } from './PurgePiston';
import { notificationSelector } from '../store/features/notifications/notification-slice';

import './piston.css';
// import { setScreen } from '../store/features/screens/screens-slice';
import { useProfileContext } from '../../context/ProfileContext';

export function PurgeScreen(): JSX.Element {
  // const dispatch = useAppDispatch();

  const { profileStarting } = useProfileContext();

  const statsName = useAppSelector((state) => state.stats.name);
  const sensors = useAppSelector((state) => state.stats.sensors);
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );

  useEffect(() => {
    if (statsName === 'idle' && !hasNotifications && !profileStarting) {
      // dispatch(setScreen('profileHome'));
    }
  }, [statsName]);

  return (
    <div className="piston-container">
      <div className="piston-purge-container center">
        <div className="values">
          <div className="value">
            {formatStatValue(sensors.p, 1)}
            <span>bar</span>
          </div>
          <PurgePiston />
          <div className="value">
            {formatStatValue(sensors.f, 1)}
            <span>ml/s</span>
          </div>
        </div>
      </div>
    </div>
  );
}

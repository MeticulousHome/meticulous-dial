import { useEffect } from 'react';
import { formatStatValue } from '../../utils';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import { PurgePiston } from './PurgePiston';
import { notificationSelector } from '../store/features/notifications/notification-slice';

import './piston.css';
import { setScreen } from '../store/features/screens/screens-slice';
import { loadProfileData, startProfile } from '../../api/profile';
import { useProfileContext } from '../../context/ProfileContext';

export function PurgeScreen(): JSX.Element {
  const dispatch = useAppDispatch();

  const {
    mergedProfiles,
    localProfileIndex: activeProfile,
    profileStarting
  } = useProfileContext();

  const statsName = useAppSelector((state) => state.stats.name);
  const sensors = useAppSelector((state) => state.stats.sensors);
  const hasNotifications = useAppSelector(
    notificationSelector.selectHasNotifications
  );
  const prevScreen = useAppSelector((state) => state.screen.prev);

  useEffect(() => {
    if (statsName === 'idle' && !hasNotifications && !profileStarting) {
      dispatch(setScreen('profileHome'));
    }
  }, [statsName]);

  // send the profile and start it only when coming from profileHome and
  // the profileStarting flag is set

  useEffect(() => {
    const loadAndStartProfile = async () => {
      const profile = mergedProfiles?.[activeProfile];

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isLast, temporary, ...cleanProfile } = profile;
      const data = await loadProfileData(cleanProfile);

      if (data) {
        await startProfile();
        console.log('starting profile');
      } else {
        console.log('loadProfileData returned nothing, not starting profile');
      }
    };

    if (prevScreen === 'profileHome' && profileStarting) {
      loadAndStartProfile();
    }
  }, []);

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

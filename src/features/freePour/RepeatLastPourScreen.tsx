import { useEffect, useState } from 'react';
import { LoadingScreen } from '../../components/LoadingScreen/LoadingScreen';
import { setScreen } from '../../components/store/features/screens/screens-slice';
import { useAppDispatch } from '../../components/store/hooks';
import { FreePourScreen } from './FreePourScreen';
import { logFreePourError } from './logging';
import { createRepeatPourOverProfile } from './profile';
import { getLatestFreePourOnlySession } from './storage';
import { PourOverProfile } from './types';

export const RepeatLastPourScreen = () => {
  const dispatch = useAppDispatch();
  const [profile, setProfile] = useState<PourOverProfile | null>();

  useEffect(() => {
    getLatestFreePourOnlySession()
      .then((session) => {
        const repeatProfile = session
          ? createRepeatPourOverProfile(session)
          : null;
        if (!repeatProfile) {
          dispatch(setScreen('profileHome'));
          return;
        }
        setProfile(repeatProfile);
      })
      .catch((error) => {
        logFreePourError('repeat_profile_load_failed', error);
        dispatch(setScreen('profileHome'));
      });
  }, [dispatch]);

  if (!profile) return <LoadingScreen />;
  return <FreePourScreen profile={profile} />;
};

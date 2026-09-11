import { useEffect, useState } from 'react';

import { LoadingScreen } from '../../components/LoadingScreen/LoadingScreen';
import { setScreen } from '../../components/store/features/screens/screens-slice';
import { useAppDispatch } from '../../components/store/hooks';
import { useProfileContext } from '../../context/ProfileContext';
import { FreePourScreen } from './FreePourScreen';
import { logFreePourError } from './logging';
import { getInstalledPourOverProfile } from './profileApi';
import { PourOverProfile } from './types';

export const GuidedPourOverScreen = () => {
  const dispatch = useAppDispatch();
  const { selectedPourOverProfileId } = useProfileContext();
  const [loadedProfile, setLoadedProfile] = useState<{
    id: string;
    profile: PourOverProfile;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!selectedPourOverProfileId) {
      setLoadedProfile(null);
      dispatch(setScreen('profileHome'));
      return;
    }

    setLoadedProfile(null);

    getInstalledPourOverProfile(selectedPourOverProfileId)
      .then((installedProfile) => {
        if (!cancelled) {
          setLoadedProfile({
            id: selectedPourOverProfileId,
            profile: installedProfile
          });
        }
      })
      .catch((error) => {
        if (cancelled) return;
        logFreePourError('guided_profile_load_failed', error, {
          profile_id: selectedPourOverProfileId
        });
        dispatch(setScreen('profileHome'));
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch, selectedPourOverProfileId]);

  if (!loadedProfile || loadedProfile.id !== selectedPourOverProfileId) {
    return <LoadingScreen />;
  }
  return <FreePourScreen profile={loadedProfile.profile} />;
};

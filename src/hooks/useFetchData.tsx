import { useEffect, useState } from 'react';
import {
  getPresets,
  loadDefaultProfiles
} from '../components/store/features/preset/preset-slice';
import { useAppDispatch, useAppSelector } from '../components/store/hooks';
import { api } from '../api/api';

const API_URL = window.env.SERVER_URL || 'http://localhost:8080';

export function useFetchData(onReady?: () => void) {
  const dispatch = useAppDispatch();
  const presetsState = useAppSelector((state) => state.presets.status);
  const defaultProfileState = useAppSelector(
    (state) => state.presets.defaultProfilesInfo.status
  );
  const activePreset = useAppSelector((state) => state.presets.activePreset);

  const presetID = useAppSelector(
    (state) => state.presets.activePreset?.id || -1
  );
  const [profileImageReady, setProfileImageReady] = useState(false);

  useEffect(() => {
    dispatch(getPresets({}));
    dispatch(loadDefaultProfiles());
  }, []);

  useEffect(() => {
    if (presetsState === 'failed') {
      setTimeout(() => {
        dispatch(getPresets({}));
      }, 1000);
    }
  }, [presetsState]);

  useEffect(() => {
    if (defaultProfileState === 'failed') {
      setTimeout(() => {
        dispatch(loadDefaultProfiles());
      }, 1000);
    }
  }, [defaultProfileState]);

  useEffect(() => {
    console.log('presets Ready', presetsState, presetID);

    if (presetID != -1 || presetsState === 'ready') {
      if (activePreset?.display?.image && !profileImageReady) {
        const img = new Image();
        img.onload = () => {
          setProfileImageReady(true);
        };
        // Just in case the image URL is bad we dont want to get stuck!
        img.onerror = img.onload;
        img.src = `${API_URL}${api.getProfileImageUrl(
          activePreset.display.image
        )}`;
      } else {
        console.log('calling onReady');
        if (onReady) {
          onReady();
        }
      }
    }
  }, [activePreset, presetsState, presetID, profileImageReady]);
}

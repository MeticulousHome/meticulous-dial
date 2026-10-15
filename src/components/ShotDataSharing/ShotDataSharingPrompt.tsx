import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { useHandleGestures } from '../../hooks/useHandleGestures';
import { useUpdateSettings } from '../../hooks/useSettings';
import { setScreen } from '../store/features/screens/screens-slice';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  OPT_IN_ACTIONS,
  SHOT_DATA_SHARING_LATER_NOTE,
  SHOT_DATA_SHARING_OPT_IN_COPY,
  SHOT_DATA_SHARING_TITLE,
  ShotDataSharingThanks,
  ShotDataSharingView,
  THANKS_SCREEN_DURATION_MS
} from './ShotDataSharingView';

/**
 * Full screen prompt shown right after the boot animation while the
 * `shot_data_sharing` setting has never been answered.
 */
export const ShotDataSharingPrompt = () => {
  const dispatch = useAppDispatch();
  const bubbleDisplay = useAppSelector((state) => state.screen.bubbleDisplay);
  const updateSettings = useUpdateSettings();
  const [activeIndex, setActiveIndex] = useState(0);
  const [showThanks, setShowThanks] = useState(false);
  const busy = updateSettings.isPending;

  useEffect(() => {
    if (!('__TAURI_INTERNALS__' in window)) return;
    // Reaching this interactive prompt proves startup passed the white dot.
    // Boot smoke must not depend on when the user answers the consent prompt.
    void invoke('home_ready').catch((error) => {
      console.error('Failed to report startup prompt ready:', error);
    });
  }, []);

  const goHome = () => {
    dispatch(setScreen('profileHome'));
  };

  useEffect(() => {
    if (!showThanks) return;
    const timer = setTimeout(() => {
      dispatch(setScreen('profileHome'));
    }, THANKS_SCREEN_DURATION_MS);
    return () => clearTimeout(timer);
  }, [dispatch, showThanks]);

  useHandleGestures(
    {
      left() {
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      },
      right() {
        setActiveIndex((prev) => Math.min(prev + 1, OPT_IN_ACTIONS.length - 1));
      },
      pressDown() {
        if (busy) return;
        if (OPT_IN_ACTIONS[activeIndex].key === 'help_improve') {
          updateSettings.mutate(
            { shot_data_sharing: true },
            { onSuccess: () => setShowThanks(true) }
          );
        } else {
          updateSettings.mutate(
            { shot_data_sharing: false },
            { onSuccess: goHome }
          );
        }
      }
    },
    showThanks || bubbleDisplay.interceptsGesture
  );

  if (showThanks) {
    return <ShotDataSharingThanks />;
  }

  return (
    <ShotDataSharingView
      title={SHOT_DATA_SHARING_TITLE}
      copy={SHOT_DATA_SHARING_OPT_IN_COPY}
      footnote={SHOT_DATA_SHARING_LATER_NOTE}
      actions={OPT_IN_ACTIONS}
      activeIndex={activeIndex}
      busy={busy}
      error={updateSettings.isError}
    />
  );
};
